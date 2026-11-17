import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, sites } from "@cms/db";
import { requireSuperAdmin, requireApiKey } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";
import { extractPageSeo, findUnresolvedPlaceholders, parsePageDocument } from "../lib/parser.js";
import { sql } from "drizzle-orm";

const createPageSchema = z.object({
  sectionKey: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  rawText: z.string().min(1),
});
const previewPageSchema = z.object({ rawText: z.string().min(1) });
const updatePageSchema = createPageSchema.extend({ expectedVersion: z.number().int().positive() });
const restorePageRevisionSchema = z.object({ expectedVersion: z.number().int().positive() });

export async function pageRoutes(app: FastifyInstance) {
  // ADMIN: Preview parsing without creating or publishing a page
  app.post("/api/admin/sites/:siteId/pages/preview", { preHandler: requireSuperAdmin }, async (req) => {
    const parsed = previewPageSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.badRequest("Document text is required");
    return {
      sections: parsePageDocument(parsed.data.rawText),
      seo: extractPageSeo(parsed.data.rawText),
      warnings: findUnresolvedPlaceholders(parsed.data.rawText),
    };
  });

  // ADMIN: Create a new page
  app.post("/api/admin/sites/:siteId/pages", { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    const parsed = createPageSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.badRequest("Invalid body");

    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) throw Errors.notFound("Site not found");

    const sections = parsePageDocument(parsed.data.rawText);
    const seo = extractPageSeo(parsed.data.rawText);

    let page;
    try {
      [page] = await db.execute(sql`
        INSERT INTO pages (site_id, section_key, title, slug, raw_content, parsed_sections, seo_title, seo_description, seo_canonical, status)
        VALUES (${siteId}, ${parsed.data.sectionKey}, ${parsed.data.title}, ${parsed.data.slug}, ${parsed.data.rawText}, ${JSON.stringify(sections)}::jsonb, ${seo.title ?? null}, ${seo.description ?? null}, ${seo.canonical ?? null}, 'draft')
        RETURNING *
      `);
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
        throw Errors.conflict("A page with this slug already exists in that section");
      }
      throw err;
    }

    return { page };
  });

  // ADMIN: Get all pages for the dashboard list
  app.get("/api/admin/sites/:siteId/pages", { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    
    const pages = await db.execute(sql`
      SELECT id, section_key, title, slug, status, created_at 
      FROM pages 
      WHERE site_id = ${siteId}
      ORDER BY created_at DESC
    `);
    
    return { pages };
  });

  app.get("/api/admin/sites/:siteId/pages/:pageId", { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId, pageId } = req.params as { siteId: string; pageId: string };
    const [page] = await db.execute(sql`
      SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1
    `);
    if (!page) throw Errors.notFound("Page not found");
    return { page };
  });

  app.put("/api/admin/sites/:siteId/pages/:pageId", { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId, pageId } = req.params as { siteId: string; pageId: string };
    const parsed = updatePageSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.badRequest("Invalid page update");
    const sections = parsePageDocument(parsed.data.rawText);
    const seo = extractPageSeo(parsed.data.rawText);
    try {
      const page = await db.transaction(async (tx) => {
        const [existing] = await tx.execute(sql`
          SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1 FOR UPDATE
        `);
        if (!existing) throw Errors.notFound("Page not found");
        if (existing.status !== "draft") throw Errors.conflict("Only draft pages can be edited");
        if (existing.version !== parsed.data.expectedVersion) throw Errors.conflict("Page changed since it was loaded; refresh and try again");

        const snapshot = {
          title: existing.title,
          section_key: existing.section_key,
          slug: existing.slug,
          raw_content: existing.raw_content,
          parsed_sections: existing.parsed_sections,
          seo_title: existing.seo_title,
          seo_description: existing.seo_description,
          seo_canonical: existing.seo_canonical,
        };
        await tx.execute(sql`
          INSERT INTO page_revisions (page_id, version, snapshot, created_by)
          VALUES (${pageId}, ${existing.version}, ${JSON.stringify(snapshot)}::jsonb, ${req.user!.sub})
          ON CONFLICT (page_id, version) DO NOTHING
        `);

        const [updated] = await tx.execute(sql`
          UPDATE pages SET section_key = ${parsed.data.sectionKey}, title = ${parsed.data.title}, slug = ${parsed.data.slug},
            raw_content = ${parsed.data.rawText}, parsed_sections = ${JSON.stringify(sections)}::jsonb,
            seo_title = ${seo.title ?? null}, seo_description = ${seo.description ?? null}, seo_canonical = ${seo.canonical ?? null},
            version = version + 1, updated_at = now()
          WHERE id = ${pageId} AND site_id = ${siteId} AND status = 'draft' AND version = ${parsed.data.expectedVersion}
          RETURNING *
        `);
        if (!updated) throw Errors.conflict("Page changed while saving; refresh and try again");
        return updated;
      });
      return { page };
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
        throw Errors.conflict("A page with this slug already exists in that section");
      }
      throw err;
    }
  });

  app.get("/api/admin/sites/:siteId/pages/:pageId/revisions", { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId, pageId } = req.params as { siteId: string; pageId: string };
    const [page] = await db.execute(sql`SELECT id FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1`);
    if (!page) throw Errors.notFound("Page not found");
    const revisions = await db.execute(sql`
      SELECT id, version, snapshot, created_at
      FROM page_revisions
      WHERE page_id = ${pageId}
      ORDER BY version DESC
    `);
    return { revisions };
  });

  app.post("/api/admin/sites/:siteId/pages/:pageId/revisions/:revisionId/restore", { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId, pageId, revisionId } = req.params as { siteId: string; pageId: string; revisionId: string };
    const parsed = restorePageRevisionSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.badRequest("Invalid revision restore request");
    try {
      const page = await db.transaction(async (tx) => {
        const [existing] = await tx.execute(sql`
          SELECT * FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1 FOR UPDATE
        `);
        if (!existing) throw Errors.notFound("Page not found");
        if (existing.status !== "draft") throw Errors.conflict("Unpublish this page before restoring a revision");
        if (existing.version !== parsed.data.expectedVersion) throw Errors.conflict("Page changed since it was loaded; refresh and try again");

        const [revision] = await tx.execute(sql`
          SELECT snapshot FROM page_revisions WHERE id = ${revisionId} AND page_id = ${pageId} LIMIT 1
        `);
        if (!revision) throw Errors.notFound("Revision not found");
        const snapshot = typeof revision.snapshot === "string" ? JSON.parse(revision.snapshot) : revision.snapshot;
        const validSnapshot = snapshot && typeof snapshot === "object" && createPageSchema.safeParse({
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
        const [restored] = await tx.execute(sql`
          UPDATE pages SET section_key = ${snapshot.section_key}, title = ${snapshot.title}, slug = ${snapshot.slug},
            raw_content = ${snapshot.raw_content}, parsed_sections = ${JSON.stringify(sections)}::jsonb,
            seo_title = ${snapshot.seo_title ?? seo.title ?? null},
            seo_description = ${snapshot.seo_description ?? seo.description ?? null},
            seo_canonical = ${snapshot.seo_canonical ?? seo.canonical ?? null},
            version = version + 1, updated_at = now()
          WHERE id = ${pageId} AND site_id = ${siteId} AND status = 'draft' AND version = ${parsed.data.expectedVersion}
          RETURNING *
        `);
        if (!restored) throw Errors.conflict("Page changed while restoring; refresh and try again");
        return restored;
      });
      return { page };
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
        throw Errors.conflict("The revision cannot be restored because its slug is already in use");
      }
      throw err;
    }
  });

  // ADMIN: Publish a draft page for this site
  app.post("/api/admin/sites/:siteId/pages/:pageId/publish", { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId, pageId } = req.params as { siteId: string; pageId: string };
    const [existing] = await db.execute(sql`
      SELECT id, status, raw_content FROM pages WHERE id = ${pageId} AND site_id = ${siteId} LIMIT 1
    `);
    if (!existing) throw Errors.notFound("Page not found");
    if (existing.status !== "draft") {
      throw Errors.conflict("Only draft pages can be published");
    }
    const rawContent = typeof existing.raw_content === "string" ? existing.raw_content : "";
    const sections = parsePageDocument(rawContent);
    if (sections.length === 0) {
      throw Errors.badRequest("This page has no renderable content. Add a heading or content section before publishing.");
    }
    const placeholders = findUnresolvedPlaceholders(rawContent);
    if (placeholders.length) throw Errors.badRequest("Replace unresolved placeholders before publishing", { placeholders });

    const [page] = await db.execute(sql`
      UPDATE pages
      SET status = 'published', published_at = now(), updated_at = now(), version = version + 1
      WHERE id = ${pageId} AND site_id = ${siteId} AND status = 'draft'
      RETURNING id, section_key, title, slug, status, published_at
    `);
    if (!page) throw Errors.conflict("Page status changed; refresh and try again");
    return { page };
  });

  // ADMIN: Unpublish a live page and return it to drafts
  app.post("/api/admin/sites/:siteId/pages/:pageId/unpublish", { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId, pageId } = req.params as { siteId: string; pageId: string };
    const [page] = await db.execute(sql`
      UPDATE pages
      SET status = 'draft', published_at = NULL, updated_at = now(), version = version + 1
      WHERE id = ${pageId} AND site_id = ${siteId} AND status = 'published'
      RETURNING id, section_key, title, slug, status, published_at
    `);
    if (!page) throw Errors.conflict("Page not found or is not currently published");
    return { page };
  });

  // PUBLIC: Get all published pages (for the Navbar)
  app.get("/api/v1/sites/:siteSlug/pages", { preHandler: requireApiKey("read") }, async (req) => {
    const { siteSlug } = req.params as { siteSlug: string };
    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.siteSlug, siteSlug)).limit(1);
    if (!site) throw Errors.notFound("Site not found");

    if (req.siteScope?.siteId !== site.id) {
  throw Errors.forbidden("API key not valid for this site");
}

    const pages = await db.execute(sql`
      SELECT id, section_key, title, slug, updated_at FROM pages 
      WHERE site_id = ${site.id} AND status = 'published'
      ORDER BY section_key, title
    `);

    
    
    return { pages };
  });

  // PUBLIC: Get a single page
  app.get("/api/v1/sites/:siteSlug/pages/:sectionKey/:slug", { preHandler: requireApiKey("read") }, async (req) => {
    const { siteSlug, sectionKey, slug } = req.params as any;
    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.siteSlug, siteSlug)).limit(1);
    if (!site) throw Errors.notFound("Site not found");
    if (req.siteScope?.siteId !== site.id) {
  throw Errors.forbidden("API key not valid for this site");
}
    
    const [page] = await db.execute(sql`
      SELECT * FROM pages 
      WHERE site_id = ${site.id} AND section_key = ${sectionKey} AND slug = ${slug} AND status = 'published'
      LIMIT 1
    `);

    if (!page) throw Errors.notFound("Page not found");
    page.parsed_sections = parsePageDocument(typeof page.raw_content === "string" ? page.raw_content : "");
    return { page };
  });
}
