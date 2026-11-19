import crypto from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { and, asc, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db, deployments, events, siteSettings, webhooks, webhookDeliveries } from "@cms/db";
import { publishPageNow, unpublishPageNow } from "./pagePublishing.js";
import { recoverLocalDeployments, runDeploymentJob } from "./deploymentRunner.js";
import { deleteFromS3 } from "./storage.js";

const MAX_ATTEMPTS = 8;
const CLAIM_STALE_AFTER_MS = 2 * 60_000;

function isPublicAddress(address: string): boolean {
  if (address.startsWith("::ffff:")) return isPublicAddress(address.slice(7));
  if (address.includes(":")) {
    const ip = address.toLowerCase();
    // Only globally routable unicast space (2000::/3); deny loopback, ULA,
    // link-local, multicast, unspecified, and documentation ranges.
    return (ip.startsWith("2") || ip.startsWith("3")) && !ip.startsWith("2001:db8:");
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return a !== 0 && a !== 10 && a !== 127 && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 0 || b === 168)) && a < 224;
}

async function assertSafeTarget(raw: string, allowLocalLoopback = false): Promise<URL> {
  const url = new URL(raw);
  if (!(url.protocol === "http:" || url.protocol === "https:") || url.username || url.password) throw new Error("Target URL is not allowed");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const localLoopback = hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "::1";
  if (allowLocalLoopback && process.env.NODE_ENV !== "production" && localLoopback && url.protocol === "http:") return url;
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new Error("Private network target is not allowed");
  const directIp = isIP(hostname);
  const addresses = directIp ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error("Private network target is not allowed");
  return url;
}

async function postSafe(raw: string, init: RequestInit, allowLocalLoopback = false): Promise<Response> {
  const url = await assertSafeTarget(raw, allowLocalLoopback);
  // Do not follow redirects: each redirect would need its own DNS/IP policy check.
  return fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(5000) });
}

async function getSitePublicUrl(siteId: string): Promise<string | null> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings)
    .where(and(eq(siteSettings.siteId, siteId), eq(siteSettings.key, "public_url"))).limit(1);
  return typeof row?.value === "string" ? row.value.replace(/\/+$/, "") : null;
}

async function getLocalDeploymentUrl(siteId: string): Promise<string | null> {
  const [row] = await db.select({ liveUrl: deployments.liveUrl }).from(deployments)
    .where(and(eq(deployments.siteId, siteId), eq(deployments.target, "local"), eq(deployments.status, "READY")))
    .orderBy(desc(deployments.createdAt)).limit(1);
  return row?.liveUrl ?? null;
}

async function triggerSiteRevalidation(siteId: string, eventType: string, payload: Record<string, unknown>) {
  const secret = process.env.REVALIDATE_SECRET;
  const baseUrl = (await getSitePublicUrl(siteId)) ?? (await getLocalDeploymentUrl(siteId)) ?? process.env.DEFAULT_REVALIDATE_URL ?? null;
  if (!secret || !baseUrl) throw new Error("Revalidation URL or secret is not configured");
  const res = await postSafe(`${baseUrl}/api/revalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
    body: JSON.stringify({ eventType, sectionKey: payload.sectionKey, slug: payload.slug, previousSectionKey: payload.previousSectionKey, previousSlug: payload.previousSlug, menuKey: payload.menuKey, contentTypeKey: payload.contentTypeKey }),
  }, true);
  if (!res.ok) throw new Error(`Revalidation failed: ${res.status}`);
}

async function deliverWebhooks(siteId: string, eventId: string, eventType: string, payload: unknown) {
  const hooks = await db.select().from(webhooks).where(and(eq(webhooks.siteId, siteId), eq(webhooks.active, true)));
  for (const hook of hooks) {
    if (!hook.events.includes(eventType) && !hook.events.includes("*")) continue;
    const [done] = await db.select({ id: webhookDeliveries.id }).from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.webhookId, hook.id), eq(webhookDeliveries.eventId, eventId), eq(webhookDeliveries.status, "success"))).limit(1);
    if (done) continue;
    const body = JSON.stringify({ eventId, type: eventType, payload, timestamp: new Date().toISOString() });
    const signature = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
    let status: "success" | "failed" = "failed";
    let responseCode = "ERR";
    try {
      const response = await postSafe(hook.url, { method: "POST", headers: { "Content-Type": "application/json", "X-CMS-Signature": signature, "X-CMS-Event": eventType }, body });
      responseCode = String(response.status);
      if (response.ok) status = "success";
    } catch (error) {
      responseCode = error instanceof Error ? error.name.slice(0, 40) : "ERR";
      console.error(JSON.stringify({ level: "error", event: "webhook.delivery", eventId, webhookId: hook.id, error: error instanceof Error ? error.message : String(error) }));
    }
    await db.insert(webhookDeliveries).values({ webhookId: hook.id, eventId, status, responseCode });
    if (status === "failed") throw new Error(`Webhook delivery failed for ${hook.id}`);
  }
}

async function claimEvents(limit: number) {
  const now = new Date();
  return db.transaction(async (tx) => {
    // Recover leases abandoned by a worker process that exited mid-delivery.
    await tx.update(events).set({ status: "pending", claimedAt: null })
      .where(and(eq(events.status, "processing"), or(isNull(events.claimedAt), lt(events.claimedAt, new Date(Date.now() - CLAIM_STALE_AFTER_MS)))));
    const rows = await tx.select().from(events)
      .where(and(eq(events.status, "pending"), lt(events.availableAt, now)))
      .orderBy(asc(events.createdAt)).limit(limit).for("update", { skipLocked: true });
    for (const event of rows) {
      await tx.update(events).set({ status: "processing", claimedAt: now, attempts: sql`${events.attempts} + 1` })
        .where(and(eq(events.id, event.id), eq(events.status, "pending")));
    }
    return rows.map((event) => ({ ...event, attempts: event.attempts + 1 }));
  });
}

export async function processPendingOutboxEvents(limit = 20): Promise<number> {
  const claimed = await claimEvents(limit);
  let processedCount = 0;
  for (const event of claimed) {
    const heartbeat = setInterval(() => {
      db.update(events).set({ claimedAt: new Date() })
        .where(and(eq(events.id, event.id), eq(events.status, "processing")))
        .catch((error) => console.error(JSON.stringify({ level: "error", event: "outbox.heartbeat", eventId: event.id, error: error instanceof Error ? error.message : String(error) })));
    }, 30_000);
    heartbeat.unref();
    try {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      if (event.siteId && (event.type === "page.schedule.publish" || event.type === "page.schedule.unpublish")) {
        if (typeof payload.pageId !== "string") throw new Error("Scheduled page event is missing its page id");
        const actorId = typeof payload.actorId === "string" ? payload.actorId : null;
        const action = {
          siteId: event.siteId,
          pageId: payload.pageId,
          actorId,
          expectedScheduledAt: event.availableAt,
        };
        const scheduledResult = event.type === "page.schedule.publish"
          ? await publishPageNow(action)
          : await unpublishPageNow(action);
        if (!scheduledResult) {
          await db.update(events).set({ status: "processed", processedAt: new Date(), claimedAt: null }).where(eq(events.id, event.id));
          processedCount += 1;
          continue;
        }
      }
      if (event.type === "deployment.requested") {
        if (typeof payload.deploymentId !== "string" || typeof payload.siteSlug !== "string" || typeof payload.target !== "string") {
          throw new Error("Deployment event is missing its deployment id, site slug, or target");
        }
        await runDeploymentJob(payload.deploymentId, payload.siteSlug, payload.target);
      }
      if (event.type === "media.delete") {
        if (typeof payload.storageKey !== "string" || !payload.storageKey) {
          throw new Error("Media deletion event is missing its storage key");
        }
        await deleteFromS3(payload.storageKey);
      }
      if (event.siteId && ["page.published", "page.unpublished", "page.deleted", "settings.updated", "menu.updated", "content.updated", "content.published", "content.unpublished", "content.deleted"].includes(event.type)) {
        await triggerSiteRevalidation(event.siteId, event.type, payload);
      }
      if (event.siteId) await deliverWebhooks(event.siteId, event.id, event.type, payload);
      await db.update(events).set({ status: "processed", processedAt: new Date(), claimedAt: null }).where(eq(events.id, event.id));
      processedCount += 1;
    } catch (error) {
      const dead = event.attempts >= MAX_ATTEMPTS;
      const delayMs = Math.min(60 * 60_000, 1000 * 2 ** Math.min(event.attempts, 12));
      await db.update(events).set({ status: dead ? "failed" : "pending", claimedAt: null, availableAt: new Date(Date.now() + delayMs) }).where(eq(events.id, event.id));
      const message = error instanceof Error ? error.message : String(error);
      if (dead && event.type === "deployment.requested") {
        const deploymentId = (event.payload as Record<string, unknown> | null)?.deploymentId;
        if (typeof deploymentId === "string") {
          const [deployment] = await db.select().from(deployments).where(eq(deployments.id, deploymentId)).limit(1);
          if (deployment && !["CANCELLED", "READY", "FAILED"].includes(deployment.status)) {
            await db.update(deployments).set({
              status: "FAILED",
              errorMessage: `Deployment worker stopped after ${MAX_ATTEMPTS} attempts: ${message}`,
              finishedAt: new Date(),
              logs: `${deployment.logs}\n[${new Date().toISOString()}] Deployment worker stopped after ${MAX_ATTEMPTS} attempts: ${message}`,
            }).where(and(eq(deployments.id, deploymentId), eq(deployments.status, deployment.status)));
          }
        }
      }
      console.error(JSON.stringify({ level: "error", event: "outbox.processing", eventId: event.id, type: event.type, attempt: event.attempts, deadLetter: dead, error: message }));
    } finally {
      clearInterval(heartbeat);
    }
  }
  return processedCount;
}

export function startOutboxWorker(intervalMs = 5000): NodeJS.Timeout {
  let running = false;
  const recoveryTimer = setInterval(() => {
    recoverLocalDeployments().catch((error) => console.error(JSON.stringify({ level: "error", event: "deployment.recovery", error: error instanceof Error ? error.message : String(error) })));
  }, 60_000);
  recoveryTimer.unref();
  return setInterval(() => {
    if (running) return;
    running = true;
    processPendingOutboxEvents().catch((error) => console.error(JSON.stringify({ level: "error", event: "outbox.batch", error: error instanceof Error ? error.message : String(error) }))).finally(() => { running = false; });
  }, intervalMs);
}
