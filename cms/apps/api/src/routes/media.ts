import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import {
  db,
  sites,
  media,
  contentEntries,
  mediaUsages,
} from "@cms/db";
import { requireSuperAdmin, requireApiKey } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";
import {
  buildStorageKey,
  uploadToS3,
  publicUrlForKey,
} from "../lib/storage.js";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/admin/sites/:siteId/media",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };

      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.id, siteId))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");

      const data = await req.file({ limits: { fileSize: MAX_SIZE } });
      if (!data) throw Errors.badRequest("No file uploaded");

      const buffer = await data.toBuffer();
      if (buffer.length === 0) throw Errors.badRequest("Empty file");
      if (buffer.length > MAX_SIZE) throw Errors.badRequest("File too large");

      const altText = (data.fields?.altText as any)?.value as string | undefined;

      const key = buildStorageKey(siteId, data.filename);
      await uploadToS3(key, buffer, data.mimetype);

      const url = publicUrlForKey(key);

      const [created] = await db
        .insert(media)
        .values({
          siteId,
          filename: data.filename,
          storageKey: key,
          url,
          mime: data.mimetype,
          size: buffer.length,
          altText: altText ?? null,
          createdBy: req.user!.sub,
        })
        .returning();

      return { media: created };
    }
  );

  app.get(
    "/api/admin/sites/:siteId/media",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const rows = await db
        .select()
        .from(media)
        .where(eq(media.siteId, siteId));
      return { media: rows };
    }
  );

  app.put(
    "/api/admin/media/:id",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = req.body as { altText?: string; caption?: string };
      const [updated] = await db
        .update(media)
        .set({
          altText: body.altText ?? null,
          caption: body.caption ?? null,
        })
        .where(eq(media.id, id))
        .returning();
      if (!updated) throw Errors.notFound("Media not found");
      return { media: updated };
    }
  );

  app.delete(
    "/api/admin/media/:id",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
      // Block deletion if used anywhere
      const usages = await db
        .select({ id: mediaUsages.id })
        .from(mediaUsages)
        .where(eq(mediaUsages.mediaId, id))
        .limit(1);
      if (usages.length > 0) {
        throw Errors.conflict("Media is in use — remove usages first");
      }
      const [deleted] = await db
        .delete(media)
        .where(eq(media.id, id))
        .returning({ id: media.id });
      if (!deleted) throw Errors.notFound("Media not found");
      return { deleted: true };
    }
  );

  // Public: list media for a site (read key)
  app.get(
    "/api/v1/sites/:siteSlug/media",
    { preHandler: requireApiKey("read") },
    async (req) => {
      const { siteSlug } = req.params as { siteSlug: string };
      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.siteSlug, siteSlug))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");
      if (req.siteScope?.siteId !== site.id) {
        throw Errors.forbidden("API key not valid for this site");
      }
      const rows = await db
        .select()
        .from(media)
        .where(eq(media.siteId, site.id));
      return { media: rows };
    }
  );
}