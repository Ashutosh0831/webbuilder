import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  sites,
  deployments,
  auditLog,
  events,
  formSubmissions,
} from "@cms/db";
import { requireSiteRole } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";
import { ensureDeploymentHealthy, runDeploymentJob } from "../lib/deploymentRunner.js";

const createDeploymentSchema = z.object({
  target: z.enum(["local", "docker", "vercel"]).default("local"),
  domain: z.string().max(255).optional(),
});

const updateSubmissionStatusSchema = z.object({
  status: z.enum(["new", "read", "spam"]),
});

export async function deploymentRoutes(app: FastifyInstance): Promise<void> {
  // Trigger a new deployment (non-blocking background job)
  app.post(
    "/api/admin/sites/:siteId/deployments",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const parsed = createDeploymentSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw Errors.badRequest("Invalid deployment request", parsed.error.flatten());
      }

      const [site] = await db
        .select({ id: sites.id, siteSlug: sites.siteSlug })
        .from(sites)
        .where(eq(sites.id, siteId))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");

      const created = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${siteId}, 0))`);
        const [active] = await tx.select({ id: deployments.id }).from(deployments)
          .where(and(eq(deployments.siteId, siteId), inArray(deployments.status, ["PENDING", "BUILDING"])))
          .limit(1);
        if (active) throw Errors.conflict("A deployment is already running for this website");
        const [deployment] = await tx.insert(deployments).values({
          siteId,
          status: "PENDING",
          target: parsed.data.target,
          domain: parsed.data.domain ?? null,
          logs: `[${new Date().toISOString()}] Deployment queued (${parsed.data.target})`,
          triggeredBy: req.user!.sub,
        }).returning();
        await tx.insert(events).values({
          siteId,
          type: "deployment.requested",
          payload: { deploymentId: deployment.id, siteSlug: site.siteSlug, target: parsed.data.target },
        });
        await tx.insert(auditLog).values({
          siteId,
          userId: req.user!.sub,
          action: "deployment.triggered",
          entityType: "deployment",
          entityId: deployment.id,
          after: { target: parsed.data.target, domain: parsed.data.domain ?? null },
          ip: req.ip,
        });
        return deployment;
      });

      return { deployment: created };
    }
  );

  // List deployments for a site
  app.get(
    "/api/admin/sites/:siteId/deployments",
    { preHandler: requireSiteRole("viewer") },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const rows = await db
        .select()
        .from(deployments)
        .where(eq(deployments.siteId, siteId))
        .orderBy(desc(deployments.createdAt))
        .limit(50);
      return { deployments: rows };
    }
  );

  // Get single deployment + logs
  app.get(
    "/api/admin/sites/:siteId/deployments/:deploymentId",
    { preHandler: requireSiteRole("viewer") },
    async (req) => {
      const { siteId, deploymentId } = req.params as { siteId: string; deploymentId: string };
      const [row] = await db
        .select()
        .from(deployments)
        .where(and(eq(deployments.id, deploymentId), eq(deployments.siteId, siteId)))
        .limit(1);
      if (!row) throw Errors.notFound("Deployment not found");
      return { deployment: row };
    }
  );

  // Cancel a deployment before the worker starts it.
  app.post(
    "/api/admin/sites/:siteId/deployments/:deploymentId/cancel",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, deploymentId } = req.params as { siteId: string; deploymentId: string };
      const updated = await db.transaction(async (tx) => {
        const [existing] = await tx.select().from(deployments)
          .where(and(eq(deployments.id, deploymentId), eq(deployments.siteId, siteId)))
          .limit(1).for("update");
        if (!existing) throw Errors.notFound("Deployment not found");
        if (existing.status !== "PENDING") throw Errors.conflict("Only a queued deployment can be cancelled");
        const [cancelled] = await tx.update(deployments)
          .set({ status: "CANCELLED", finishedAt: new Date(), logs: `${existing.logs}\n[${new Date().toISOString()}] Deployment cancelled before it started` })
          .where(and(eq(deployments.id, deploymentId), eq(deployments.status, "PENDING"))).returning();
        if (!cancelled) throw Errors.conflict("Deployment status changed; refresh and try again");
        await tx.update(events).set({ status: "processed", processedAt: new Date(), claimedAt: null })
          .where(and(eq(events.siteId, siteId), eq(events.type, "deployment.requested"), eq(events.status, "pending"), sql`${events.payload}->>'deploymentId' = ${deploymentId}`));
        await tx.insert(auditLog).values({
          siteId,
          userId: req.user!.sub,
          action: "deployment.cancelled",
          entityType: "deployment",
          entityId: deploymentId,
          after: { target: existing.target },
          ip: req.ip,
        });
        return cancelled;
      });
      return { deployment: updated };
    }
  );

  // Retry a failed deployment by enqueueing a fresh durable job.
  app.post(
    "/api/admin/sites/:siteId/deployments/:deploymentId/retry",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, deploymentId } = req.params as { siteId: string; deploymentId: string };
      const deployment = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${siteId}, 0))`);
        const [existing] = await tx.select().from(deployments)
          .where(and(eq(deployments.id, deploymentId), eq(deployments.siteId, siteId)))
          .limit(1).for("update");
        if (!existing) throw Errors.notFound("Deployment not found");
        if (existing.status !== "FAILED") throw Errors.conflict("Only a failed deployment can be retried");
        const [active] = await tx.select({ id: deployments.id }).from(deployments)
          .where(and(eq(deployments.siteId, siteId), inArray(deployments.status, ["PENDING", "BUILDING"])))
          .limit(1);
        if (active) throw Errors.conflict("Another deployment is already running for this website");

        const [site] = await tx.select({ siteSlug: sites.siteSlug }).from(sites).where(eq(sites.id, siteId)).limit(1);
        if (!site) throw Errors.notFound("Site not found");
        const retryLog = `[${new Date().toISOString()}] Deployment retry queued (${existing.target})`;
        const [retried] = await tx.update(deployments).set({
          status: "PENDING",
          errorMessage: null,
          finishedAt: null,
          logs: `${existing.logs}\n${retryLog}`,
        }).where(and(eq(deployments.id, deploymentId), eq(deployments.status, "FAILED"))).returning();
        if (!retried) throw Errors.conflict("Deployment status changed; refresh and try again");
        await tx.insert(events).values({
          siteId,
          type: "deployment.requested",
          payload: { deploymentId, siteSlug: site.siteSlug, target: existing.target },
        });
        await tx.insert(auditLog).values({
          siteId,
          userId: req.user!.sub,
          action: "deployment.retried",
          entityType: "deployment",
          entityId: deploymentId,
          after: { target: existing.target },
          ip: req.ip,
        });
        return retried;
      });
      return { deployment };
    }
  );

  // Rollback to a previous READY deployment
  app.post(
    "/api/admin/sites/:siteId/deployments/:deploymentId/rollback",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, deploymentId } = req.params as { siteId: string; deploymentId: string };
      const [targetDep] = await db
        .select()
        .from(deployments)
        .where(and(eq(deployments.id, deploymentId), eq(deployments.siteId, siteId)))
        .limit(1);
      if (!targetDep) throw Errors.notFound("Deployment not found");
      if (targetDep.status !== "READY") {
        throw Errors.conflict("Can only roll back to a READY deployment");
      }
      if (targetDep.target !== "local" && targetDep.target !== "docker") {
        throw Errors.conflict(`Rollback is not implemented for the ${targetDep.target} provider`);
      }
      if (!targetDep.liveUrl || !targetDep.outputPath) {
        throw Errors.conflict("This deployment is missing its saved URL or immutable build snapshot");
      }
      const [site] = await db.select({ siteSlug: sites.siteSlug }).from(sites).where(eq(sites.id, siteId)).limit(1);
      if (!site) throw Errors.notFound("Site not found");
      try {
        await ensureDeploymentHealthy(targetDep.id, site.siteSlug, targetDep.target, targetDep.liveUrl, targetDep.outputPath);
      } catch (error) {
        throw Errors.conflict(`Rollback target failed its health check: ${error instanceof Error ? error.message : String(error)}`);
      }
      const activated = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${siteId}, 0))`);
        const [activeBuild] = await tx.select({ id: deployments.id }).from(deployments)
          .where(and(eq(deployments.siteId, siteId), inArray(deployments.status, ["PENDING", "BUILDING"])))
          .limit(1);
        if (activeBuild) throw Errors.conflict("A deployment is running. Wait for it to finish before rolling back.");
        const now = new Date();
        const [rollback] = await tx.insert(deployments).values({
          siteId,
          status: "READY",
          target: targetDep.target,
          domain: targetDep.domain,
          liveUrl: targetDep.liveUrl,
          outputPath: targetDep.outputPath,
          rollbackFromId: targetDep.id,
          triggeredBy: req.user!.sub,
          createdAt: now,
          finishedAt: now,
          logs: `[${now.toISOString()}] Rolled back to deployment ${targetDep.id}; verified healthy at ${targetDep.liveUrl}`,
        }).returning();
        await tx.insert(auditLog).values({
          siteId,
          userId: req.user!.sub,
          action: "deployment.rolled_back",
          entityType: "deployment",
          entityId: rollback.id,
          after: { rollbackFromId: targetDep.id, target: targetDep.target, liveUrl: targetDep.liveUrl },
          ip: req.ip,
        });
        return rollback;
      });
      return { deployment: activated };
    }
  );

  // Audit logs for a site
  app.get(
    "/api/admin/sites/:siteId/audit-logs",
    { preHandler: requireSiteRole("viewer") },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const rows = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.siteId, siteId))
        .orderBy(desc(auditLog.createdAt))
        .limit(100);
      return { logs: rows };
    }
  );

  // Update form submission status (new / read / spam)
  app.patch(
    "/api/admin/sites/:siteId/submissions/:submissionId",
    { preHandler: requireSiteRole("editor") },
    async (req) => {
      const { siteId, submissionId } = req.params as { siteId: string; submissionId: string };
      const parsed = updateSubmissionStatusSchema.safeParse(req.body);
      if (!parsed.success) throw Errors.badRequest("Invalid status");

      const [updated] = await db
        .update(formSubmissions)
        .set({ status: parsed.data.status })
        .where(and(eq(formSubmissions.id, submissionId), eq(formSubmissions.siteId, siteId)))
        .returning();
      if (!updated) throw Errors.notFound("Submission not found");
      return { submission: updated };
    }
  );

  // Export form submissions as CSV
  app.get(
    "/api/admin/sites/:siteId/submissions/export",
    { preHandler: requireSiteRole("viewer") },
    async (req, reply) => {
      const { siteId } = req.params as { siteId: string };
      const rows = await db
        .select()
        .from(formSubmissions)
        .where(eq(formSubmissions.siteId, siteId))
        .orderBy(desc(formSubmissions.createdAt));

      const escapeCsv = (v: unknown) => {
        const s = typeof v === "string" ? v : JSON.stringify(v ?? "");
        return `"${s.replace(/"/g, '""')}"`;
      };
      const lines = ["id,status,createdAt,data"];
      for (const r of rows) {
        lines.push([escapeCsv(r.id), escapeCsv(r.status), escapeCsv(r.createdAt), escapeCsv(r.data)].join(","));
      }
      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="submissions-${siteId}.csv"`);
      return lines.join("\n");
    }
  );
}
