import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, sites } from "@cms/db";
import { requireSuperAdmin, requireApiKey } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";
import { parsePageDocument } from "../lib/parser.js";
import { sql } from "drizzle-orm";

const createPageSchema = z.object({
  sectionKey: z.string(),
  title: z.string(),
  slug: z.string(),
  rawText: z.string(),
});

export async function pageRoutes(app: FastifyInstance) {
  // ADMIN: Create a new page
  app.post("/api/admin/sites/:siteId/pages", { preHandler: requireSuperAdmin }, async (req) => {
    const { siteId } = req.params as { siteId: string };
    const parsed = createPageSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.badRequest("Invalid body");

    const sections = parsePageDocument(parsed.data.rawText);

    const [page] = (await db.execute(sql`
      INSERT INTO pages (site_id, section_key, title, slug, raw_content, parsed_sections, status)
      VALUES (${siteId}, ${parsed.data.sectionKey}, ${parsed.data.title}, ${parsed.data.slug}, ${parsed.data.rawText}, ${JSON.stringify(sections)}::jsonb, 'published')
      RETURNING *
    `)).rows;

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
    
    return { pages: pages.rows };
  });

  // PUBLIC: Get all published pages (for the Navbar)
  app.get("/api/v1/sites/:siteSlug/pages", { preHandler: requireApiKey("read") }, async (req) => {
    const { siteSlug } = req.params as { siteSlug: string };
    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.siteSlug, siteSlug)).limit(1);
    if (!site) throw Errors.notFound("Site not found");

    const pages = await db.execute(sql`
      SELECT id, section_key, title, slug FROM pages 
      WHERE site_id = ${site.id} AND status = 'published'
      ORDER BY section_key, title
    `);
    
    return { pages: pages.rows };
  });

  // PUBLIC: Get a single page
  app.get("/api/v1/sites/:siteSlug/pages/:sectionKey/:slug", { preHandler: requireApiKey("read") }, async (req) => {
    const { siteSlug, sectionKey, slug } = req.params as any;
    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.siteSlug, siteSlug)).limit(1);
    if (!site) throw Errors.notFound("Site not found");
    
    const [page] = (await db.execute(sql`
      SELECT * FROM pages 
      WHERE site_id = ${site.id} AND section_key = ${sectionKey} AND slug = ${slug} AND status = 'published'
      LIMIT 1
    `)).rows;

    if (!page) throw Errors.notFound("Page not found");
    return { page };
  });
}