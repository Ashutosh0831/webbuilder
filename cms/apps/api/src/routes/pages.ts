import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, sites, pages, siteSettings, auditLog, events, pageReviewHistory } from "@cms/db";
import {
  resolveSitePlaceholders,
  resolveSitePlaceholdersDeep,
} from "@cms/resolver";
import { requireApiKey, requireSiteRole, resolveUserSiteRole } from "../middleware/auth.js";
import { hasMinSiteRole } from "@cms/shared";
import { Errors } from "../lib/errors.js";
import { publishPageNow, unpublishPageNow } from "../lib/pagePublishing.js";
import {
  extractPageSeo,
  findUnresolvedPlaceholders,
  parsePageDocument,
  parsePageDocumentDetailed,
} from "../lib/parser.js";

const createPageSchema = z.object({
  sectionKey: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  rawText: z.string().min(1),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  seoCanonical: z.string().max(500).nullable().optional(),
  seoOgImage: z.string().max(500).nullable().optional(),
  seoRobots: z.string().max(100).nullable().optional(),
});
const previewPageSchema = z.object({ rawText: z.string().min(1) });
const updatePageSchema = createPageSchema.extend({
  expectedVersion: z.number().int().positive(),
});
const restorePageRevisionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});
const submitReviewSchema = z.object({
  assignedReviewerId: z.string().uuid().nullable().optional(),
  comment: z.string().max(2000).optional(),
});
const reviewDecisionSchema = z.object({ comment: z.string().trim().max(2000).optional() });
const rejectReviewSchema = z.object({ comment: z.string().trim().min(1).max(2000) });
const schedulePageSchema = z.object({ scheduledAt: z.string().datetime({ offset: true }) });

async function getSiteSettingsMap(siteId: string): Promise<Record<string, unknown>> {
  const rows = await db
    .select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.siteId, siteId));
  const map: Record<string, unknown> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

export async function pageRoutes(app: FastifyInstance) {
  // ADMIN: Preview parsing with site placeholder resolution & diagnostics
  app.post(
    "/api/admin/sites/:siteId/pages/preview",
    { preHandler: requireSiteRole("editor") },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const parsed = previewPageSchema.safeParse(req.body);
      if (!parsed.success) throw Errors.badRequest("Document text is required");

      const settingsMap = await getSiteSettingsMap(siteId);
      const resolvedRaw = resolveSitePlaceholders(parsed.data.rawText, settingsMap);
      const result = parsePageDocumentDetailed(resolvedRaw);

      return {
        schemaVersion: result.schemaVersion,
        sections: result.sections,
        seo: result.seo,
        warnings: result.unresolvedPlaceholders, // backward-compatible string[]
        diagnostics: result.warnings,
        errors: result.errors,
        unresolvedPlaceholders: result.unresolvedPlaceholders,
        unknownSections: result.unknownSections,
      };
    }
  );

  // ADMIN: Create a new page
  app.post(
    "/api/admin/sites/:siteId/pages",
    { preHandler: requireSiteRole("editor") },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const parsed = createPageSchema.safeParse(req.body);
      if (!parsed.success) throw Errors.badRequest("Invalid body", parsed.error.flatten());

      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.id, siteId))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");

      const detailed = parsePageDocumentDetailed(parsed.data.rawText);
      const seoTitle = parsed.data.seoTitle ?? detailed.seo.title ?? null;
      const seoDescription = parsed.data.seoDescription ?? detailed.seo.description ?? null;
      const seoCanonical = parsed.data.seoCanonical ?? detailed.seo.canonical ?? null;

      try {
        const result = await db.execute(sql`
          INSERT INTO pages (
            site_id, section_key, title, slug, raw_content, parsed_sections,
            seo_title, seo_description, seo_canonical, seo_og_image, seo_robots,
            status, created_by, updated_by
          )
          VALUES (
            ${siteId}, ${parsed.data.sectionKey}, ${parsed.data.title}, ${parsed.data.slug},
            ${parsed.data.rawText}, ${JSON.stringify(detailed.sections)}::jsonb,
            ${seoTitle}, ${seoDescription}, ${seoCanonical},
            ${parsed.data.seoOgImage ?? null}, ${parsed.data.seoRobots ?? null},
            'draft', ${req.user!.sub}, ${req.user!.sub}
          )
          RETURNING *
        `);
        const page = result[0];
        await db.insert(auditLog).values({
          siteId,
          userId: req.user!.sub,
          action: "page.created",
          entityType: "page",
          entityId: String(page.id),
          after: { title: parsed.data.title, slug: parsed.data.slug, sectionKey: parsed.data.sectionKey },
          ip: req.ip,
        });
        return { page };
      } catch (err) {
        if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
          throw Errors.conflict("A page with this slug already exists in that section");
        }
        throw err;
      }
    }
  );

  // ADMIN: Get all pages
  app.get(
    "/api/admin/sites/:siteId/pages",
    { preHandler: requireSiteRole("viewer") },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const result = await db.execute(sql`
        SELECT id, section_key, title, slug, status, version, has_unpublished_changes, published_version, published_at, updated_at, created_at
        FROM pages
        WHERE site_id = ${siteId}
        ORDER BY updated_at DESC, created_at DESC
      `);
      return { pages: result };
    }
  );

  // ADMIN: Duplicate the current editable version into a fresh draft.
  app.post(
    "/api/admin/sites/:siteId/pages/:pageId/duplicate",
    { preHandler: requireSiteRole("editor") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      let duplicate: typeof pages.$inferSelect;
      try {
        duplicate = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${siteId}, 0))`);
        const [source] = await tx.select().from(pages)
          .where(and(eq(pages.id, pageId), eq(pages.siteId, siteId))).limit(1).for("update");
        if (!source) throw Errors.notFound("Page not found");

        const storedDraft = source.draftContent
          ? typeof source.draftContent === "string" ? JSON.parse(source.draftContent) : source.draftContent
          : null;
        const draft = storedDraft && typeof storedDraft === "object" ? storedDraft as Record<string, unknown> : {};
        const sectionKey = typeof draft.section_key === "string" ? draft.section_key : source.sectionKey;
        const sourceTitle = typeof draft.title === "string" ? draft.title : source.title;
        const rawContent = typeof draft.raw_content === "string" ? draft.raw_content : source.rawContent ?? "";
        const parsedContent = parsePageDocumentDetailed(rawContent);
        const baseSlug = source.slug.slice(0, 185).replace(/-+$/, "") || "page";
        let slug = `${baseSlug}-copy`;
        for (let suffix = 2; suffix <= 10_000; suffix += 1) {
          const [collision] = await tx.select({ id: pages.id }).from(pages)
            .where(and(eq(pages.siteId, siteId), eq(pages.sectionKey, sectionKey), eq(pages.slug, slug))).limit(1);
          if (!collision) break;
          slug = `${baseSlug}-copy-${suffix}`;
        }
        const [collision] = await tx.select({ id: pages.id }).from(pages)
          .where(and(eq(pages.siteId, siteId), eq(pages.sectionKey, sectionKey), eq(pages.slug, slug))).limit(1);
        if (collision) throw Errors.conflict("Could not find an available slug for the duplicate page");

        const [created] = await tx.insert(pages).values({
          siteId,
          sectionKey,
          title: sourceTitle,
          slug,
          rawContent,
          parsedSections: parsedContent.sections,
          blocks: source.blocks,
          seoTitle: typeof draft.seo_title === "string" ? draft.seo_title : source.seoTitle,
          seoDescription: typeof draft.seo_description === "string" ? draft.seo_description : source.seoDescription,
          seoCanonical: typeof draft.seo_canonical === "string" ? draft.seo_canonical : source.seoCanonical,
          seoOgImage: typeof draft.seo_og_image === "string" ? draft.seo_og_image : source.seoOgImage,
          seoRobots: typeof draft.seo_robots === "string" ? draft.seo_robots : source.seoRobots,
          status: "draft",
          approvalStatus: "draft",
          hasUnpublishedChanges: false,
          publishedVersion: null,
          draftContent: null,
          assignedReviewerId: null,
          scheduledPublishAt: null,
          scheduledUnpublishAt: null,
          createdBy: req.user!.sub,
          updatedBy: req.user!.sub,
        }).returning();
        await tx.insert(auditLog).values({
          siteId,
          userId: req.user!.sub,
          action: "page.duplicated",
          entityType: "page",
          entityId: created.id,
          before: { sourcePageId: source.id },
          after: { title: created.title, slug: created.slug, sectionKey: created.sectionKey },
          ip: req.ip,
        });
          return created;
        });
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
          throw Errors.conflict("A page with the generated duplicate slug already exists");
        }
        throw error;
      }
      return { page: duplicate };
    }
  );

  // ADMIN: Get single page (returns draft_content overlaid for editing if present)
  app.get(
    "/api/admin/sites/:siteId/pages/:pageId",
    { preHandler: requireSiteRole("viewer") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const result = await db.execute(
        sql`SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1`
      );
      const page = result[0];
      if (!page) throw Errors.notFound("Page not found");
      return { page };
    }
  );

  // ADMIN: Update page (supports editing BOTH draft pages and published pages via draft_content)
  app.put(
    "/api/admin/sites/:siteId/pages/:pageId",
    { preHandler: requireSiteRole("editor") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const parsed = updatePageSchema.safeParse(req.body);
      if (!parsed.success) throw Errors.badRequest("Invalid page update", parsed.error.flatten());

      const detailed = parsePageDocumentDetailed(parsed.data.rawText);
      const seoTitle = parsed.data.seoTitle ?? detailed.seo.title ?? null;
      const seoDescription = parsed.data.seoDescription ?? detailed.seo.description ?? null;
      const seoCanonical = parsed.data.seoCanonical ?? detailed.seo.canonical ?? null;

      try {
        const page = await db.transaction(async (tx) => {
          const res = await tx.execute(
            sql`SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1 FOR UPDATE`
          );
          const existing = res[0] as any;
          if (!existing) throw Errors.notFound("Page not found");
          if (existing.version !== parsed.data.expectedVersion) {
            throw Errors.conflict("Page changed since it was loaded; refresh and try again");
          }
          if (existing.approval_status === "in_review") {
            throw Errors.conflict("This page is in review. Ask the reviewer to reject or return it before editing.");
          }
          if (existing.scheduled_publish_at) {
            await tx.execute(sql`
              UPDATE events SET status = 'processed', processed_at = now(), claimed_at = NULL
              WHERE site_id = ${siteId} AND type = 'page.schedule.publish'
                AND payload->>'pageId' = ${pageId} AND status IN ('pending', 'processing')
            `);
          }

          const currentDraft = existing.draft_content
            ? (typeof existing.draft_content === "string"
                ? JSON.parse(existing.draft_content)
                : existing.draft_content)
            : null;

          const snapshot = {
            title: currentDraft?.title ?? existing.title,
            section_key: currentDraft?.section_key ?? existing.section_key,
            slug: currentDraft?.slug ?? existing.slug,
            raw_content: currentDraft?.raw_content ?? existing.raw_content,
            parsed_sections: currentDraft?.parsed_sections ?? existing.parsed_sections,
            seo_title: currentDraft?.seo_title ?? existing.seo_title,
            seo_description: currentDraft?.seo_description ?? existing.seo_description,
            seo_canonical: currentDraft?.seo_canonical ?? existing.seo_canonical,
            seo_og_image: currentDraft?.seo_og_image ?? existing.seo_og_image,
            seo_robots: currentDraft?.seo_robots ?? existing.seo_robots,
          };

          await tx.execute(sql`
            INSERT INTO page_revisions (page_id, version, snapshot, created_by)
            VALUES (${pageId}, ${existing.version}, ${JSON.stringify(snapshot)}::jsonb, ${req.user!.sub})
            ON CONFLICT (page_id, version) DO NOTHING
          `);

          if (existing.status === "published") {
            // Keep live published version untouched; save changes into draft_content
            const draftPayload = {
              section_key: parsed.data.sectionKey,
              title: parsed.data.title,
              slug: parsed.data.slug,
              raw_content: parsed.data.rawText,
              parsed_sections: detailed.sections,
              seo_title: seoTitle,
              seo_description: seoDescription,
              seo_canonical: seoCanonical,
              seo_og_image: parsed.data.seoOgImage ?? null,
              seo_robots: parsed.data.seoRobots ?? null,
            };
            const upd = await tx.execute(sql`
              UPDATE pages
              SET draft_content = ${JSON.stringify(draftPayload)}::jsonb,
                  has_unpublished_changes = true,
                  approval_status = 'draft', assigned_reviewer_id = NULL,
                  review_submitted_at = NULL, reviewed_at = NULL, review_comment = NULL,
                  scheduled_publish_at = NULL,
                  updated_by = ${req.user!.sub},
                  version = version + 1,
                  updated_at = now()
              WHERE id = ${pageId} AND site_id = ${siteId} AND version = ${parsed.data.expectedVersion}
              RETURNING *
            `);
            if (!upd[0]) throw Errors.conflict("Page changed while saving; refresh and try again");
            return upd[0];
          }

          // Draft page: update primary columns directly
          const upd = await tx.execute(sql`
            UPDATE pages
            SET section_key = ${parsed.data.sectionKey},
                title = ${parsed.data.title},
                slug = ${parsed.data.slug},
                raw_content = ${parsed.data.rawText},
                parsed_sections = ${JSON.stringify(detailed.sections)}::jsonb,
                seo_title = ${seoTitle},
                seo_description = ${seoDescription},
                seo_canonical = ${seoCanonical},
                seo_og_image = ${parsed.data.seoOgImage ?? null},
                seo_robots = ${parsed.data.seoRobots ?? null},
                has_unpublished_changes = false,
                approval_status = 'draft', assigned_reviewer_id = NULL,
                review_submitted_at = NULL, reviewed_at = NULL, review_comment = NULL,
                scheduled_publish_at = NULL,
                updated_by = ${req.user!.sub},
                version = version + 1,
                updated_at = now()
            WHERE id = ${pageId} AND site_id = ${siteId} AND status = 'draft' AND version = ${parsed.data.expectedVersion}
            RETURNING *
          `);
          if (!upd[0]) throw Errors.conflict("Page changed while saving; refresh and try again");
          return upd[0];
        });
        return { page };
      } catch (err) {
        if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
          throw Errors.conflict("A page with this slug already exists in that section");
        }
        throw err;
      }
    }
  );

  // ADMIN: Get revisions
  app.get(
    "/api/admin/sites/:siteId/pages/:pageId/revisions",
    { preHandler: requireSiteRole("viewer") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const check = await db.execute(
        sql`SELECT id FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1`
      );
      if (!check[0]) throw Errors.notFound("Page not found");

      const result = await db.execute(sql`
        SELECT pr.id, pr.version, pr.snapshot, pr.created_by, pr.created_at, u.name AS editor_name, u.email AS editor_email
        FROM page_revisions pr
        LEFT JOIN users u ON u.id = pr.created_by
        WHERE pr.page_id = ${pageId}
        ORDER BY pr.version DESC
      `);
      return { revisions: result };
    }
  );

  // ADMIN: Restore revision (works for both draft and published pages)
  app.post(
    "/api/admin/sites/:siteId/pages/:pageId/revisions/:revisionId/restore",
    { preHandler: requireSiteRole("editor") },
    async (req) => {
      const { siteId, pageId, revisionId } = req.params as {
        siteId: string;
        pageId: string;
        revisionId: string;
      };
      const parsed = restorePageRevisionSchema.safeParse(req.body);
      if (!parsed.success) throw Errors.badRequest("Invalid revision restore request");

      try {
        const page = await db.transaction(async (tx) => {
          const res = await tx.execute(
            sql`SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1 FOR UPDATE`
          );
          const existing = res[0] as any;
          if (!existing) throw Errors.notFound("Page not found");
          if (existing.version !== parsed.data.expectedVersion) {
            throw Errors.conflict("Page changed since it was loaded; refresh and try again");
          }
          if (existing.approval_status === "in_review") throw Errors.conflict("A page in review cannot be restored until the reviewer returns it");
          if (existing.scheduled_publish_at) {
            await tx.execute(sql`
              UPDATE events SET status = 'processed', processed_at = now(), claimed_at = NULL
              WHERE site_id = ${siteId} AND type = 'page.schedule.publish'
                AND payload->>'pageId' = ${pageId} AND status IN ('pending', 'processing')
            `);
          }

          const revRes = await tx.execute(
            sql`SELECT snapshot FROM page_revisions WHERE id = ${revisionId} AND page_id = ${pageId} LIMIT 1`
          );
          const revision = revRes[0];
          if (!revision) throw Errors.notFound("Revision not found");
          const snapshot =
            typeof revision.snapshot === "string"
              ? JSON.parse(revision.snapshot)
              : revision.snapshot;

          const validSnapshot =
            snapshot &&
            typeof snapshot === "object" &&
            createPageSchema.safeParse({
              sectionKey: snapshot.section_key,
              title: snapshot.title,
              slug: snapshot.slug,
              rawText: snapshot.raw_content,
            }).success;
          if (!validSnapshot) {
            throw Errors.badRequest("This revision cannot be restored because its snapshot is invalid");
          }

          const sections = parsePageDocument(snapshot.raw_content);
          const seo = extractPageSeo(snapshot.raw_content);

          await tx.execute(sql`
            INSERT INTO page_revisions (page_id, version, snapshot, created_by)
            VALUES (${pageId}, ${existing.version}, ${JSON.stringify({
              title: existing.title,
              section_key: existing.section_key,
              slug: existing.slug,
              raw_content: existing.raw_content,
              parsed_sections: existing.parsed_sections,
              seo_title: existing.seo_title,
              seo_description: existing.seo_description,
              seo_canonical: existing.seo_canonical,
            })}::jsonb, ${req.user!.sub})
            ON CONFLICT (page_id, version) DO NOTHING
          `);

          if (existing.status === "published") {
            const draftPayload = {
              section_key: snapshot.section_key,
              title: snapshot.title,
              slug: snapshot.slug,
              raw_content: snapshot.raw_content,
              parsed_sections: sections,
              seo_title: snapshot.seo_title ?? seo.title ?? null,
              seo_description: snapshot.seo_description ?? seo.description ?? null,
              seo_canonical: snapshot.seo_canonical ?? seo.canonical ?? null,
              seo_og_image: snapshot.seo_og_image ?? null,
              seo_robots: snapshot.seo_robots ?? null,
            };
            const rest = await tx.execute(sql`
              UPDATE pages
              SET draft_content = ${JSON.stringify(draftPayload)}::jsonb,
                  has_unpublished_changes = true,
                  approval_status = 'draft', assigned_reviewer_id = NULL,
                  review_submitted_at = NULL, reviewed_at = NULL, review_comment = NULL,
                  scheduled_publish_at = NULL,
                  updated_by = ${req.user!.sub},
                  version = version + 1,
                  updated_at = now()
              WHERE id = ${pageId} AND site_id = ${siteId} AND version = ${parsed.data.expectedVersion}
              RETURNING *
            `);
            if (!rest[0]) throw Errors.conflict("Page changed while restoring; refresh and try again");
            return rest[0];
          }

          const rest = await tx.execute(sql`
            UPDATE pages
            SET section_key = ${snapshot.section_key},
                title = ${snapshot.title},
                slug = ${snapshot.slug},
                raw_content = ${snapshot.raw_content},
                parsed_sections = ${JSON.stringify(sections)}::jsonb,
                seo_title = ${snapshot.seo_title ?? seo.title ?? null},
                seo_description = ${snapshot.seo_description ?? seo.description ?? null},
                seo_canonical = ${snapshot.seo_canonical ?? seo.canonical ?? null},
                approval_status = 'draft', assigned_reviewer_id = NULL,
                review_submitted_at = NULL, reviewed_at = NULL, review_comment = NULL,
                scheduled_publish_at = NULL,
                updated_by = ${req.user!.sub},
                version = version + 1,
                updated_at = now()
            WHERE id = ${pageId} AND site_id = ${siteId} AND status = 'draft' AND version = ${parsed.data.expectedVersion}
            RETURNING *
          `);
          if (!rest[0]) throw Errors.conflict("Page changed while restoring; refresh and try again");
          return rest[0];
        });
        return { page };
      } catch (err) {
        if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
          throw Errors.conflict("The revision cannot be restored because its slug is already in use");
        }
        throw err;
      }
    }
  );

  // Submit a saved draft (or edits to a live page) for review without changing the live website.
  app.post(
    "/api/admin/sites/:siteId/pages/:pageId/submit-review",
    { preHandler: requireSiteRole("editor") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const parsed = submitReviewSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw Errors.badRequest("Invalid review submission", parsed.error.flatten());

      const assignedReviewerId = parsed.data.assignedReviewerId ?? null;
      if (assignedReviewerId) {
        const reviewerRole = await resolveUserSiteRole(assignedReviewerId, null, siteId);
        if (!hasMinSiteRole(reviewerRole, "client_admin")) {
          throw Errors.badRequest("The assigned reviewer must be a site administrator or owner");
        }
      }

      const page = await db.transaction(async (tx) => {
        const selected = await tx.execute(sql`SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1 FOR UPDATE`);
        const existing = selected[0] as any;
        if (!existing) throw Errors.notFound("Page not found");
        if (existing.approval_status === "in_review") throw Errors.conflict("This page is already in review");
        if (existing.status === "published" && !existing.has_unpublished_changes) {
          throw Errors.conflict("Save page changes before submitting the live page for review");
        }
        if (!["draft", "published"].includes(existing.status)) throw Errors.conflict("This page cannot be submitted for review");

        const action = existing.approval_status === "rejected" ? "resubmitted" : "submitted";
        const updated = await tx.execute(sql`
          UPDATE pages
          SET approval_status = 'in_review', assigned_reviewer_id = ${assignedReviewerId},
              review_submitted_at = now(), reviewed_at = NULL, review_comment = ${parsed.data.comment ?? null},
              updated_by = ${req.user!.sub}, updated_at = now(), version = version + 1
          WHERE id = ${pageId} AND site_id = ${siteId}
          RETURNING *
        `);
        const submitted = updated[0] as any;
        await tx.insert(pageReviewHistory).values({
          siteId, pageId, pageVersion: submitted.version, action,
          actorId: req.user!.sub, assignedReviewerId, comment: parsed.data.comment ?? null,
        });
        await tx.insert(auditLog).values({
          siteId, userId: req.user!.sub, action: `page.review.${action}`, entityType: "page", entityId: pageId,
          after: { approvalStatus: "in_review", assignedReviewerId, version: submitted.version }, ip: req.ip,
        });
        await tx.insert(events).values({
          siteId, type: `page.review.${action}`,
          payload: { pageId, sectionKey: submitted.section_key, slug: submitted.slug, assignedReviewerId },
        });
        return submitted;
      });
      return { page };
    }
  );

  app.post(
    "/api/admin/sites/:siteId/pages/:pageId/approve",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const parsed = reviewDecisionSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw Errors.badRequest("Invalid approval", parsed.error.flatten());
      const page = await db.transaction(async (tx) => {
        const result = await tx.execute(sql`SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1 FOR UPDATE`);
        const existing = result[0] as any;
        if (!existing) throw Errors.notFound("Page not found");
        if (existing.approval_status !== "in_review") throw Errors.conflict("Only pages in review can be approved");
        if (existing.assigned_reviewer_id && existing.assigned_reviewer_id !== req.user!.sub && req.siteScope?.siteRole !== "client_owner") {
          throw Errors.forbidden("This review is assigned to another reviewer");
        }
        const submission = await tx.execute(sql`
          SELECT actor_id FROM page_review_history
          WHERE page_id = ${pageId} AND action IN ('submitted', 'resubmitted')
          ORDER BY created_at DESC LIMIT 1
        `);
        if (submission[0]?.actor_id === req.user!.sub && req.siteScope?.siteRole !== "client_owner") {
          throw Errors.forbidden("A different reviewer must approve your submission");
        }
        const updatedResult = await tx.execute(sql`
          UPDATE pages SET approval_status = 'approved', reviewed_at = now(),
            review_comment = ${parsed.data.comment ?? existing.review_comment}, updated_by = ${req.user!.sub},
            updated_at = now(), version = version + 1
          WHERE id = ${pageId} AND site_id = ${siteId} RETURNING *
        `);
        const approved = updatedResult[0] as any;
        await tx.insert(pageReviewHistory).values({ siteId, pageId, pageVersion: approved.version, action: "approved", actorId: req.user!.sub, assignedReviewerId: existing.assigned_reviewer_id, comment: parsed.data.comment ?? null });
        await tx.insert(auditLog).values({ siteId, userId: req.user!.sub, action: "page.review.approved", entityType: "page", entityId: pageId, after: { approvalStatus: "approved", version: approved.version }, ip: req.ip });
        await tx.insert(events).values({ siteId, type: "page.review.approved", payload: { pageId, sectionKey: approved.section_key, slug: approved.slug } });
        return approved;
      });
      return { page };
    }
  );

  app.post(
    "/api/admin/sites/:siteId/pages/:pageId/reject",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const parsed = rejectReviewSchema.safeParse(req.body);
      if (!parsed.success) throw Errors.badRequest("A rejection comment is required", parsed.error.flatten());
      const page = await db.transaction(async (tx) => {
        const selected = await tx.execute(sql`SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1 FOR UPDATE`);
        const existing = selected[0] as any;
        if (!existing) throw Errors.notFound("Page not found");
        if (existing.approval_status !== "in_review") throw Errors.conflict("Only pages in review can be rejected");
        if (existing.assigned_reviewer_id && existing.assigned_reviewer_id !== req.user!.sub && req.siteScope?.siteRole !== "client_owner") {
          throw Errors.forbidden("This review is assigned to another reviewer");
        }
        const updatedResult = await tx.execute(sql`
          UPDATE pages SET approval_status = 'rejected', reviewed_at = now(), review_comment = ${parsed.data.comment},
            updated_by = ${req.user!.sub}, updated_at = now(), version = version + 1
          WHERE id = ${pageId} AND site_id = ${siteId} RETURNING *
        `);
        const rejected = updatedResult[0] as any;
        await tx.insert(pageReviewHistory).values({ siteId, pageId, pageVersion: rejected.version, action: "rejected", actorId: req.user!.sub, assignedReviewerId: existing.assigned_reviewer_id, comment: parsed.data.comment });
        await tx.insert(auditLog).values({ siteId, userId: req.user!.sub, action: "page.review.rejected", entityType: "page", entityId: pageId, after: { approvalStatus: "rejected", version: rejected.version, comment: parsed.data.comment }, ip: req.ip });
        await tx.insert(events).values({ siteId, type: "page.review.rejected", payload: { pageId, sectionKey: rejected.section_key, slug: rejected.slug, comment: parsed.data.comment } });
        return rejected;
      });
      return { page };
    }
  );

  app.get(
    "/api/admin/sites/:siteId/pages/:pageId/review-history",
    { preHandler: requireSiteRole("viewer") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const [page] = await db.select({ id: pages.id }).from(pages).where(and(eq(pages.id, pageId), eq(pages.siteId, siteId))).limit(1);
      if (!page) throw Errors.notFound("Page not found");
      const history = await db.select().from(pageReviewHistory).where(and(eq(pageReviewHistory.pageId, pageId), eq(pageReviewHistory.siteId, siteId))).orderBy(pageReviewHistory.createdAt);
      return { history };
    }
  );

  // ADMIN: Publish page (or promote draft_content atomically for an already-published page)
  app.post(
    "/api/admin/sites/:siteId/pages/:pageId/publish",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const published = await publishPageNow({ siteId, pageId, actorId: req.user!.sub, ip: req.ip });
      return { page: published };
    }
  );

  app.post(
    "/api/admin/sites/:siteId/pages/:pageId/schedule-publish",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const parsed = schedulePageSchema.safeParse(req.body);
      if (!parsed.success) throw Errors.badRequest("A valid scheduledAt timestamp is required", parsed.error.flatten());
      const scheduledAt = new Date(parsed.data.scheduledAt);
      if (scheduledAt.getTime() < Date.now() + 30_000) throw Errors.badRequest("Schedule publishing at least 30 seconds in the future");
      if (scheduledAt.getTime() > Date.now() + 365 * 24 * 60 * 60_000) throw Errors.badRequest("Schedule publishing within the next year");

      const page = await db.transaction(async (tx) => {
        const selected = await tx.execute(sql`SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1 FOR UPDATE`);
        const existing = selected[0] as any;
        if (!existing) throw Errors.notFound("Page not found");
        if (existing.approval_status !== "approved") throw Errors.conflict("A reviewer must approve this page before it can be scheduled");
        const hasDraft = Boolean(existing.draft_content) || existing.status !== "published";
        if (!hasDraft) throw Errors.conflict("This page has no approved draft changes to publish");
        if (existing.scheduled_unpublish_at) throw Errors.conflict("Cancel the scheduled unpublish before scheduling a publish");

        await tx.execute(sql`
          UPDATE events SET status = 'processed', processed_at = now(), claimed_at = NULL
          WHERE site_id = ${siteId} AND type = 'page.schedule.publish'
            AND payload->>'pageId' = ${pageId} AND status IN ('pending', 'processing')
        `);
        const updated = await tx.execute(sql`
          UPDATE pages SET scheduled_publish_at = ${scheduledAt}, updated_by = ${req.user!.sub},
            updated_at = now(), version = version + 1
          WHERE id = ${pageId} AND site_id = ${siteId} RETURNING *
        `);
        const scheduled = updated[0] as any;
        await tx.insert(events).values({ siteId, type: "page.schedule.publish", payload: { pageId, actorId: req.user!.sub }, availableAt: scheduledAt });
        await tx.insert(auditLog).values({ siteId, userId: req.user!.sub, action: "page.publish.scheduled", entityType: "page", entityId: pageId, after: { scheduledAt: scheduledAt.toISOString(), version: scheduled.version }, ip: req.ip });
        return scheduled;
      });
      return { page };
    }
  );

  app.post(
    "/api/admin/sites/:siteId/pages/:pageId/schedule-unpublish",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const parsed = schedulePageSchema.safeParse(req.body);
      if (!parsed.success) throw Errors.badRequest("A valid scheduledAt timestamp is required", parsed.error.flatten());
      const scheduledAt = new Date(parsed.data.scheduledAt);
      if (scheduledAt.getTime() < Date.now() + 30_000) throw Errors.badRequest("Schedule unpublishing at least 30 seconds in the future");
      if (scheduledAt.getTime() > Date.now() + 365 * 24 * 60 * 60_000) throw Errors.badRequest("Schedule unpublishing within the next year");

      const page = await db.transaction(async (tx) => {
        const selected = await tx.execute(sql`SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1 FOR UPDATE`);
        const existing = selected[0] as any;
        if (!existing) throw Errors.notFound("Page not found");
        if (existing.status !== "published") throw Errors.conflict("Only a published page can be scheduled for unpublishing");
        if (existing.scheduled_publish_at) throw Errors.conflict("Cancel the scheduled publish before scheduling an unpublish");

        await tx.execute(sql`
          UPDATE events SET status = 'processed', processed_at = now(), claimed_at = NULL
          WHERE site_id = ${siteId} AND type = 'page.schedule.unpublish'
            AND payload->>'pageId' = ${pageId} AND status IN ('pending', 'processing')
        `);
        const updated = await tx.execute(sql`
          UPDATE pages SET scheduled_unpublish_at = ${scheduledAt}, updated_by = ${req.user!.sub},
            updated_at = now(), version = version + 1
          WHERE id = ${pageId} AND site_id = ${siteId} RETURNING *
        `);
        const scheduled = updated[0] as any;
        await tx.insert(events).values({ siteId, type: "page.schedule.unpublish", payload: { pageId, actorId: req.user!.sub }, availableAt: scheduledAt });
        await tx.insert(auditLog).values({ siteId, userId: req.user!.sub, action: "page.unpublish.scheduled", entityType: "page", entityId: pageId, after: { scheduledAt: scheduledAt.toISOString(), version: scheduled.version }, ip: req.ip });
        return scheduled;
      });
      return { page };
    }
  );

  app.post(
    "/api/admin/sites/:siteId/pages/:pageId/cancel-schedule",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const page = await db.transaction(async (tx) => {
        const selected = await tx.execute(sql`SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1 FOR UPDATE`);
        const existing = selected[0] as any;
        if (!existing) throw Errors.notFound("Page not found");
        if (!existing.scheduled_publish_at && !existing.scheduled_unpublish_at) throw Errors.conflict("This page has no scheduled action");
        await tx.execute(sql`
          UPDATE events SET status = 'processed', processed_at = now(), claimed_at = NULL
          WHERE site_id = ${siteId} AND type IN ('page.schedule.publish', 'page.schedule.unpublish')
            AND payload->>'pageId' = ${pageId} AND status IN ('pending', 'processing')
        `);
        const updated = await tx.execute(sql`
          UPDATE pages SET scheduled_publish_at = NULL, scheduled_unpublish_at = NULL,
            updated_by = ${req.user!.sub}, updated_at = now(), version = version + 1
          WHERE id = ${pageId} AND site_id = ${siteId} RETURNING *
        `);
        const cancelled = updated[0] as any;
        await tx.insert(auditLog).values({ siteId, userId: req.user!.sub, action: "page.schedule.cancelled", entityType: "page", entityId: pageId, after: { version: cancelled.version }, ip: req.ip });
        return cancelled;
      });
      return { page };
    }
  );

  // ADMIN: Unpublish page
  app.post(
    "/api/admin/sites/:siteId/pages/:pageId/unpublish",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      const page = await unpublishPageNow({ siteId, pageId, actorId: req.user!.sub, ip: req.ip });
      return { page };
    }
  );

  // ADMIN: Delete page
  app.delete(
    "/api/admin/sites/:siteId/pages/:pageId",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, pageId } = req.params as { siteId: string; pageId: string };
      await db.transaction(async (tx) => {
        const [removed] = await tx.delete(pages)
          .where(and(eq(pages.id, pageId), eq(pages.siteId, siteId)))
          .returning({ id: pages.id, sectionKey: pages.sectionKey, slug: pages.slug });
        if (!removed) throw Errors.notFound("Page not found");
        await tx.insert(auditLog).values({
          siteId,
          userId: req.user!.sub,
          action: "page.deleted",
          entityType: "page",
          entityId: pageId,
          after: { sectionKey: removed.sectionKey, slug: removed.slug },
          ip: req.ip,
        });
        await tx.insert(events).values({
          siteId,
          type: "page.deleted",
          payload: { pageId, sectionKey: removed.sectionKey, slug: removed.slug },
        });
      });

      return { deleted: true };
    }
  );

  // PUBLIC: Get all published pages
  app.get(
    "/api/v1/sites/:siteSlug/pages",
    { preHandler: requireApiKey("read") },
    async (req) => {
      const { siteSlug } = req.params as { siteSlug: string };
      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.siteSlug, siteSlug))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");
      if (req.siteScope?.siteId !== site.id) throw Errors.forbidden("API key not valid for this site");

      const pages = await db.execute(sql`
        SELECT id, section_key, title, slug, updated_at, published_at
        FROM pages
        WHERE site_id = ${site.id} AND status = 'published'
        ORDER BY section_key, title
      `);
      return { pages: pages };
    }
  );

  // PUBLIC: Get single published page with placeholder resolution
  app.get(
    "/api/v1/sites/:siteSlug/pages/:sectionKey/:slug",
    { preHandler: requireApiKey("read") },
    async (req) => {
      const { siteSlug, sectionKey, slug } = req.params as any;
      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.siteSlug, siteSlug))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");
      if (req.siteScope?.siteId !== site.id) throw Errors.forbidden("API key not valid for this site");

      const result = await db.execute(sql`
        SELECT * FROM pages
        WHERE site_id = ${site.id} AND section_key = ${sectionKey} AND slug = ${slug} AND status = 'published'
        LIMIT 1
      `);

      const page = result[0] as any;
      if (!page) throw Errors.notFound("Page not found");

      const settingsMap = await getSiteSettingsMap(site.id);
      const raw = typeof page.raw_content === "string" ? page.raw_content : "";
      const resolvedRaw = resolveSitePlaceholders(raw, settingsMap);
      page.parsed_sections = parsePageDocument(resolvedRaw);
      page.seo_title = page.seo_title ? resolveSitePlaceholders(page.seo_title, settingsMap) : page.seo_title;
      page.seo_description = page.seo_description
        ? resolveSitePlaceholders(page.seo_description, settingsMap)
        : page.seo_description;

      return { page: resolveSitePlaceholdersDeep(page, settingsMap) };
    }
  );

  // PREVIEW: Get draft or published page using preview API key
  app.get(
    "/api/v1/sites/:siteSlug/preview/pages/:sectionKey/:slug",
    { preHandler: requireApiKey("preview") },
    async (req) => {
      const { siteSlug, sectionKey, slug } = req.params as any;
      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.siteSlug, siteSlug))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");
      if (req.siteScope?.siteId !== site.id) throw Errors.forbidden("API key not valid for this site");

      const result = await db.execute(sql`
        SELECT * FROM pages
        WHERE site_id = ${site.id} AND section_key = ${sectionKey} AND slug = ${slug}
        LIMIT 1
      `);

      const page = result[0] as any;
      if (!page) throw Errors.notFound("Page not found");

      const draft = page.draft_content
        ? typeof page.draft_content === "string"
          ? JSON.parse(page.draft_content)
          : page.draft_content
        : null;

      const effectiveRaw = String(draft?.raw_content ?? page.raw_content ?? "");
      const settingsMap = await getSiteSettingsMap(site.id);
      const resolvedRaw = resolveSitePlaceholders(effectiveRaw, settingsMap);
      page.parsed_sections = parsePageDocument(resolvedRaw);
      if (draft) {
        page.title = draft.title ?? page.title;
        page.seo_title = draft.seo_title ?? page.seo_title;
        page.seo_description = draft.seo_description ?? page.seo_description;
      }

      return { page, preview: true };
    }
  );
}
