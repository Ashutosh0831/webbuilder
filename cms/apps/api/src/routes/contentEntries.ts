import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  sites,
  contentTypes,
  contentEntries,
  contentRevisions,
  siteSettings as siteSettingsTable,
  templates,
} from "@cms/db";
import { requireSuperAdmin, requireApiKey } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";
import {
  interpolateDeep,
  resolveSeo,
  type InterpolationContext,
} from "@cms/resolver";

const createEntrySchema = z.object({
  contentTypeId: z.string().uuid(),
  locale: z.string().min(2).max(10).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  data: z.record(z.any()),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
  seoCanonical: z.string().url().optional(),
  seoOgImage: z.string().url().optional(),
  seoRobots: z.string().max(50).optional(),
});

const updateEntrySchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  data: z.record(z.any()).optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  seoCanonical: z.string().url().nullable().optional(),
  seoOgImage: z.string().url().nullable().optional(),
  seoRobots: z.string().max(50).nullable().optional(),
  expectedVersion: z.number().int().positive(),
});

async function buildResolveContext(
  siteId: string,
  entry: { data: unknown }
): Promise<InterpolationContext> {
  const siteSettingsRows = await db
    .select({ key: siteSettingsTable.key, value: siteSettingsTable.value })
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.siteId, siteId));

  const siteSettings: Record<string, unknown> = {};
  for (const row of siteSettingsRows) {
    siteSettings[row.key] = row.value;
  }

  return {
    entry: entry.data as Record<string, unknown>,
    siteSettings,
    globalSettings: {},
  };
}

export async function contentEntryRoutes(app: FastifyInstance): Promise<void> {
  // ─── ADMIN ROUTES (JWT auth) ──────────────────────────────

  app.post(
    "/api/admin/sites/:siteId/content",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const parsed = createEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }

      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.id, siteId))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");

      const [ct] = await db
        .select({ id: contentTypes.id, siteId: contentTypes.siteId })
        .from(contentTypes)
        .where(eq(contentTypes.id, parsed.data.contentTypeId))
        .limit(1);
      if (!ct) throw Errors.notFound("Content type not found");
      if (ct.siteId !== siteId) {
        throw Errors.badRequest("Content type does not belong to this site");
      }

      try {
        const [created] = await db
          .insert(contentEntries)
          .values({
            siteId,
            contentTypeId: parsed.data.contentTypeId,
            locale: parsed.data.locale ?? "en",
            slug: parsed.data.slug,
            data: parsed.data.data,
            status: "draft",
            seoTitle: parsed.data.seoTitle,
            seoDescription: parsed.data.seoDescription,
            seoCanonical: parsed.data.seoCanonical,
            seoOgImage: parsed.data.seoOgImage,
            seoRobots: parsed.data.seoRobots,
            createdBy: req.user!.sub,
            updatedBy: req.user!.sub,
          })
          .returning();

        return { entry: created };
      } catch (err: any) {
        // Postgres unique violation → clean 409
        if (err?.code === "23505") {
          throw Errors.conflict(
            `Entry with slug '${parsed.data.slug}' already exists for this content type`
          );
        }
        throw err;
      }
    }
  );

  app.put(
    "/api/admin/content/:id",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
      const parsed = updateEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }

      const [existing] = await db
        .select()
        .from(contentEntries)
        .where(eq(contentEntries.id, id))
        .limit(1);
      if (!existing) throw Errors.notFound("Entry not found");

      if (existing.version !== parsed.data.expectedVersion) {
        throw Errors.conflict(
          `Version mismatch: current is ${existing.version}, you sent ${parsed.data.expectedVersion}`
        );
      }

      const nextVersion = existing.version + 1;

      await db.insert(contentRevisions).values({
        entryId: id,
        version: existing.version,
        data: existing.data,
        seo: {
          title: existing.seoTitle,
          description: existing.seoDescription,
          canonical: existing.seoCanonical,
          ogImage: existing.seoOgImage,
          robots: existing.seoRobots,
        },
        status: existing.status,
        createdBy: req.user!.sub,
      });

      const updateFields: Record<string, unknown> = {
        version: nextVersion,
        updatedBy: req.user!.sub,
        updatedAt: new Date(),
      };
      if (parsed.data.slug !== undefined) updateFields.slug = parsed.data.slug;
      if (parsed.data.data !== undefined) updateFields.data = parsed.data.data;
      if (parsed.data.seoTitle !== undefined)
        updateFields.seoTitle = parsed.data.seoTitle;
      if (parsed.data.seoDescription !== undefined)
        updateFields.seoDescription = parsed.data.seoDescription;
      if (parsed.data.seoCanonical !== undefined)
        updateFields.seoCanonical = parsed.data.seoCanonical;
      if (parsed.data.seoOgImage !== undefined)
        updateFields.seoOgImage = parsed.data.seoOgImage;
      if (parsed.data.seoRobots !== undefined)
        updateFields.seoRobots = parsed.data.seoRobots;

      const [updated] = await db
        .update(contentEntries)
        .set(updateFields)
        .where(eq(contentEntries.id, id))
        .returning();

      return { entry: updated };
    }
  );

  app.post(
    "/api/admin/content/:id/publish",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
      const [existing] = await db
        .select()
        .from(contentEntries)
        .where(eq(contentEntries.id, id))
        .limit(1);
      if (!existing) throw Errors.notFound("Entry not found");

      const [updated] = await db
        .update(contentEntries)
        .set({
          status: "published",
          publishedAt: new Date(),
          updatedBy: req.user!.sub,
        })
        .where(eq(contentEntries.id, id))
        .returning();

      return { entry: updated };
    }
  );

  app.post(
    "/api/admin/content/:id/unpublish",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
      const [updated] = await db
        .update(contentEntries)
        .set({ status: "draft", updatedBy: req.user!.sub })
        .where(eq(contentEntries.id, id))
        .returning();
      if (!updated) throw Errors.notFound("Entry not found");
      return { entry: updated };
    }
  );

  app.delete(
    "/api/admin/content/:id",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
      const [deleted] = await db
        .delete(contentEntries)
        .where(eq(contentEntries.id, id))
        .returning({ id: contentEntries.id });
      if (!deleted) throw Errors.notFound("Entry not found");
      return { deleted: true, id: deleted.id };
    }
  );

  app.get(
    "/api/admin/sites/:siteId/content",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const q = req.query as { typeId?: string; status?: string };
      let query = db
        .select()
        .from(contentEntries)
        .where(eq(contentEntries.siteId, siteId))
        .$dynamic();
      if (q.typeId) {
        query = query.where(
          and(
            eq(contentEntries.siteId, siteId),
            eq(contentEntries.contentTypeId, q.typeId)
          )
        );
      }
      const rows = await query.orderBy(desc(contentEntries.updatedAt));
      return { entries: rows };
    }
  );

  // ─── PUBLIC READ ROUTES (API key auth, published only, RESOLVED) ──

  app.get(
    "/api/v1/sites/:siteSlug/content/:typeKey",
    { preHandler: requireApiKey("read") },
    async (req) => {
      const { siteSlug, typeKey } = req.params as {
        siteSlug: string;
        typeKey: string;
      };

      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.siteSlug, siteSlug))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");

      if (req.siteScope?.siteId !== site.id) {
        throw Errors.forbidden("API key not valid for this site");
      }

      const [ct] = await db
        .select({ id: contentTypes.id })
        .from(contentTypes)
        .where(
          and(eq(contentTypes.siteId, site.id), eq(contentTypes.key, typeKey))
        )
        .limit(1);
      if (!ct) throw Errors.notFound("Content type not found");

      const rows = await db
        .select()
        .from(contentEntries)
        .where(
          and(
            eq(contentEntries.siteId, site.id),
            eq(contentEntries.contentTypeId, ct.id),
            eq(contentEntries.status, "published")
          )
        )
        .orderBy(desc(contentEntries.publishedAt));

      const resolved = await Promise.all(
        rows.map(async (entry) => {
          const ctx = await buildResolveContext(site.id, entry);
          const { resolved: data } = interpolateDeep(entry.data, ctx);
          return { ...entry, data };
        })
      );

      return { entries: resolved };
    }
  );

  app.get(
    "/api/v1/sites/:siteSlug/content/:typeKey/:slug",
    { preHandler: requireApiKey("read") },
    async (req) => {
      const { siteSlug, typeKey, slug } = req.params as {
        siteSlug: string;
        typeKey: string;
        slug: string;
      };

      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.siteSlug, siteSlug))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");

      if (req.siteScope?.siteId !== site.id) {
        throw Errors.forbidden("API key not valid for this site");
      }

      const [ct] = await db
        .select({ id: contentTypes.id })
        .from(contentTypes)
        .where(
          and(eq(contentTypes.siteId, site.id), eq(contentTypes.key, typeKey))
        )
        .limit(1);
      if (!ct) throw Errors.notFound("Content type not found");

      const [entry] = await db
        .select()
        .from(contentEntries)
        .where(
          and(
            eq(contentEntries.siteId, site.id),
            eq(contentEntries.contentTypeId, ct.id),
            eq(contentEntries.slug, slug),
            eq(contentEntries.status, "published")
          )
        )
        .limit(1);
      if (!entry) throw Errors.notFound("Entry not found or not published");

      const ctx = await buildResolveContext(site.id, entry);
      const { resolved: data, missing } = interpolateDeep(entry.data, ctx);

      const [seoTemplate] = await db
        .select()
        .from(templates)
        .where(
          and(
            eq(templates.siteId, site.id),
            eq(templates.appliesTo, typeKey)
          )
        )
        .limit(1);

      const seo = resolveSeo({
        manual: {
          title: entry.seoTitle,
          description: entry.seoDescription,
          canonical: entry.seoCanonical,
          ogImage: entry.seoOgImage,
          robots: entry.seoRobots,
        },
        template: seoTemplate
          ? {
              titleTemplate: `${(seoTemplate.variableMap as any)?.titleTemplate ?? ""}`,
              descriptionTemplate: `${(seoTemplate.variableMap as any)?.descriptionTemplate ?? ""}`,
            }
          : null,
        siteDefaults: {},
        ctx,
        canonicalUrl: entry.seoCanonical ?? "",
      });

      return {
        entry: { ...entry, data },
        seo,
        missingPlaceholders: missing.length > 0 ? missing : undefined,
      };
    }
  );
}