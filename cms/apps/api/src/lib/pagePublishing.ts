import { eq, sql } from "drizzle-orm";
import { db, siteSettings, auditLog, events } from "@cms/db";
import { resolveSitePlaceholders } from "@cms/resolver";
import { findUnresolvedPlaceholders, parsePageDocumentDetailed } from "./parser.js";
import { Errors } from "./errors.js";

async function loadSiteSettings(siteId: string): Promise<Record<string, unknown>> {
  const rows = await db.select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings).where(eq(siteSettings.siteId, siteId));
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function publishPageNow(input: {
  siteId: string;
  pageId: string;
  actorId: string | null;
  ip?: string;
  expectedScheduledAt?: Date;
}) {
  const settings = await loadSiteSettings(input.siteId);
  return db.transaction(async (tx) => {
    const selected = await tx.execute(sql`
      SELECT * FROM pages WHERE id = ${input.pageId} AND site_id = ${input.siteId} LIMIT 1 FOR UPDATE
    `);
    const existing = selected[0] as any;
    if (!existing) throw Errors.notFound("Page not found");

    if (input.expectedScheduledAt) {
      const scheduledAt = existing.scheduled_publish_at ? new Date(existing.scheduled_publish_at).getTime() : null;
      if (scheduledAt !== input.expectedScheduledAt.getTime() || scheduledAt > Date.now()) return null;
    } else if (existing.scheduled_publish_at) {
      await tx.execute(sql`
        UPDATE events SET status = 'processed', processed_at = now(), claimed_at = NULL
        WHERE site_id = ${input.siteId} AND type = 'page.schedule.publish'
          AND payload->>'pageId' = ${input.pageId} AND status IN ('pending', 'processing')
      `);
    }
    if (existing.approval_status !== "approved") throw Errors.conflict("A reviewer must approve this page before it can be published");

    const draft = existing.draft_content
      ? typeof existing.draft_content === "string" ? JSON.parse(existing.draft_content) : existing.draft_content
      : null;
    if (existing.status === "published" && !draft) throw Errors.conflict("This page is already published with no pending draft changes");

    const targetRaw = String(draft?.raw_content ?? existing.raw_content ?? "");
    const targetTitle = String(draft?.title ?? existing.title ?? "");
    const targetSlug = String(draft?.slug ?? existing.slug ?? "");
    const targetSection = String(draft?.section_key ?? existing.section_key ?? "");
    const resolvedRaw = resolveSitePlaceholders(targetRaw, settings);
    const detailed = parsePageDocumentDetailed(resolvedRaw);
    if (detailed.sections.length === 0) throw Errors.badRequest("This page has no renderable content. Add a heading or content section before publishing.");
    const placeholders = findUnresolvedPlaceholders(resolvedRaw);
    if (placeholders.length) throw Errors.badRequest("Replace unresolved placeholders before publishing", { placeholders });

    if (draft && (targetSlug !== existing.slug || targetSection !== existing.section_key)) {
      const conflict = await tx.execute(sql`
        SELECT id FROM pages
        WHERE site_id = ${input.siteId} AND section_key = ${targetSection} AND slug = ${targetSlug} AND id <> ${input.pageId}
        LIMIT 1
      `);
      if (conflict[0]) throw Errors.conflict("A page with this slug already exists in that section");
    }

    const updatedRows = await tx.execute(sql`
      UPDATE pages
      SET section_key = ${targetSection}, title = ${targetTitle}, slug = ${targetSlug},
          raw_content = ${targetRaw}, parsed_sections = ${JSON.stringify(detailed.sections)}::jsonb,
          seo_title = ${draft?.seo_title ?? existing.seo_title ?? detailed.seo.title ?? null},
          seo_description = ${draft?.seo_description ?? existing.seo_description ?? detailed.seo.description ?? null},
          seo_canonical = ${draft?.seo_canonical ?? existing.seo_canonical ?? detailed.seo.canonical ?? null},
          seo_og_image = ${draft?.seo_og_image ?? existing.seo_og_image ?? null},
          seo_robots = ${draft?.seo_robots ?? existing.seo_robots ?? null},
          draft_content = NULL, has_unpublished_changes = false, status = 'published',
          approval_status = 'draft', assigned_reviewer_id = NULL, review_submitted_at = NULL,
          reviewed_at = NULL, review_comment = NULL, scheduled_publish_at = NULL,
          published_at = COALESCE(published_at, now()), published_version = version + 1,
          updated_by = ${input.actorId}, updated_at = now(), version = version + 1
      WHERE id = ${input.pageId} AND site_id = ${input.siteId}
      RETURNING id, section_key, title, slug, status, approval_status, published_at, published_version, version, has_unpublished_changes
    `);
    const page = updatedRows[0] as any;
    await tx.insert(auditLog).values({
      siteId: input.siteId, userId: input.actorId, action: "page.published", entityType: "page", entityId: input.pageId,
      after: { sectionKey: targetSection, slug: targetSlug, version: page.version, scheduled: Boolean(input.expectedScheduledAt) }, ip: input.ip,
    });
    await tx.insert(events).values({
      siteId: input.siteId, type: "page.published",
      payload: { pageId: input.pageId, sectionKey: targetSection, slug: targetSlug, previousSectionKey: existing.section_key, previousSlug: existing.slug, scheduled: Boolean(input.expectedScheduledAt) },
    });
    return page;
  });
}

export async function unpublishPageNow(input: {
  siteId: string;
  pageId: string;
  actorId: string | null;
  ip?: string;
  expectedScheduledAt?: Date;
}) {
  return db.transaction(async (tx) => {
    const selected = await tx.execute(sql`
      SELECT * FROM pages WHERE id = ${input.pageId} AND site_id = ${input.siteId} LIMIT 1 FOR UPDATE
    `);
    const existing = selected[0] as any;
    if (!existing) {
      if (input.expectedScheduledAt) return null;
      throw Errors.notFound("Page not found");
    }
    if (input.expectedScheduledAt) {
      const scheduledAt = existing.scheduled_unpublish_at ? new Date(existing.scheduled_unpublish_at).getTime() : null;
      if (scheduledAt !== input.expectedScheduledAt.getTime() || scheduledAt > Date.now()) return null;
    } else {
      if (existing.status !== "published") throw Errors.conflict("Page is not currently published");
      if (existing.scheduled_unpublish_at) {
        await tx.execute(sql`
          UPDATE events SET status = 'processed', processed_at = now(), claimed_at = NULL
          WHERE site_id = ${input.siteId} AND type = 'page.schedule.unpublish'
            AND payload->>'pageId' = ${input.pageId} AND status IN ('pending', 'processing')
        `);
      }
    }
    if (existing.status !== "published") return null;
    const updatedRows = await tx.execute(sql`
      UPDATE pages SET status = 'draft', published_at = NULL, scheduled_unpublish_at = NULL,
        updated_by = ${input.actorId}, updated_at = now(), version = version + 1
      WHERE id = ${input.pageId} AND site_id = ${input.siteId}
      RETURNING id, section_key, title, slug, status, version
    `);
    const page = updatedRows[0] as any;
    await tx.insert(auditLog).values({ siteId: input.siteId, userId: input.actorId, action: "page.unpublished", entityType: "page", entityId: input.pageId, after: { scheduled: Boolean(input.expectedScheduledAt), version: page.version }, ip: input.ip });
    await tx.insert(events).values({ siteId: input.siteId, type: "page.unpublished", payload: { pageId: input.pageId, sectionKey: page.section_key, slug: page.slug, scheduled: Boolean(input.expectedScheduledAt) } });
    return page;
  });
}
