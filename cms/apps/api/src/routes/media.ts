import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  sites,
  media,
  events,
  mediaUsages,
  pages,
  contentEntries,
  siteSettings,
} from "@cms/db";
import {
  assertUserSiteRole,
  requireApiKey,
  requireJwt,
  requireSiteRole,
} from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";
import { validateImageSignature } from "../lib/fileSignature.js";
import { InvalidMediaFolderError, normalizeMediaFolder } from "../lib/mediaFolder.js";
import { randomUUID } from "node:crypto";
import {
  buildStorageKey,
  uploadToS3,
  downloadFromS3,
  deleteFromS3,
} from "../lib/storage.js";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const mediaDetailsSchema = z.object({
  altText: z.string().max(500).optional(),
  caption: z.string().max(2000).optional(),
  folder: z.string().max(255).optional(),
});

function multipartText(value: unknown): string {
  if (!value || typeof value !== "object" || !("value" in value)) return "";
  return typeof value.value === "string" ? value.value.trim() : "";
}

function validatedFolder(raw: string): string {
  try {
    return normalizeMediaFolder(raw);
  } catch (error) {
    if (error instanceof InvalidMediaFolderError) throw Errors.badRequest(error.message);
    throw error;
  }
}

function publicMediaUrl(id: string): string {
  const baseUrl = (process.env.API_PUBLIC_URL ?? process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");
  return `${baseUrl}/api/v1/media/${id}`;
}

function contentReferencesMedia(value: unknown, mediaId: string, storageKey: string): boolean {
  if (typeof value === "string") {
    return value.includes(`/api/v1/media/${mediaId}`) || value.includes(storageKey);
  }
  if (Array.isArray(value)) return value.some((item) => contentReferencesMedia(item, mediaId, storageKey));
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => contentReferencesMedia(item, mediaId, storageKey));
  }
  return false;
}

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  // Public media is served through the API so browsers never need S3 credentials or bucket permissions.
  app.get("/api/v1/media/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw Errors.notFound("Media not found");
    }
    const [asset] = await db
      .select({ id: media.id, storageKey: media.storageKey, mime: media.mime })
      .from(media)
      .where(eq(media.id, id))
      .limit(1);
    if (!asset) throw Errors.notFound("Media not found");

    const body = await downloadFromS3(asset.storageKey);
    return reply
      .header("Content-Type", asset.mime)
      .header("Content-Length", body.length)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .header("ETag", `\"${asset.id}\"`)
      .send(body);
  });

  app.post(
    "/api/admin/sites/:siteId/media",
    { preHandler: requireSiteRole("editor") },
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

      // Validate actual file signature (magic bytes), not MIME type alone
      const detected = validateImageSignature(buffer);
      if (!detected) {
        throw Errors.badRequest(
          "Invalid image file signature. Supported formats: PNG, JPEG, GIF, WebP, AVIF."
        );
      }

      const rawAltText = multipartText(data.fields?.altText);
      if (rawAltText.length > 500) throw Errors.badRequest("Image alt text must be 500 characters or fewer");
      const altText = rawAltText || undefined;
      const folder = validatedFolder(multipartText(data.fields?.folder));

      const key = buildStorageKey(siteId, `upload${detected.ext}`);
      await uploadToS3(key, buffer, detected.mime);
      const id = randomUUID();
      const url = publicMediaUrl(id);

      let created: typeof media.$inferSelect;
      try {
        [created] = await db
          .insert(media)
          .values({
            id,
            siteId,
            filename: data.filename,
            folder,
            storageKey: key,
            url,
            mime: detected.mime,
            size: buffer.length,
            width: detected.width ?? null,
            height: detected.height ?? null,
            altText: altText ?? null,
            createdBy: req.user!.sub,
          })
          .returning();
      } catch (error) {
        await deleteFromS3(key).catch((cleanupError) => {
          req.log.error({ key, error: cleanupError }, "Failed to clean up uploaded media after database insert failed");
        });
        throw error;
      }

      return { media: created };
    }
  );

  app.get(
    "/api/admin/sites/:siteId/media",
    { preHandler: requireSiteRole("viewer") },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const rows = await db
        .select()
        .from(media)
        .where(eq(media.siteId, siteId));
      return { media: rows.map((asset) => ({ ...asset, url: publicMediaUrl(asset.id) })) };
    }
  );

  app.put(
    "/api/admin/media/:id",
    { preHandler: requireJwt },
    async (req) => {
      const { id } = req.params as { id: string };
      const [existing] = await db
        .select({ id: media.id, siteId: media.siteId })
        .from(media)
        .where(eq(media.id, id))
        .limit(1);
      if (!existing) throw Errors.notFound("Media not found");

      await assertUserSiteRole(req, existing.siteId, "editor");

      const parsed = mediaDetailsSchema.safeParse(req.body);
      if (!parsed.success) throw Errors.badRequest("Invalid media details", parsed.error.flatten());
      const folder = parsed.data.folder === undefined ? undefined : validatedFolder(parsed.data.folder);
      const [updated] = await db
        .update(media)
        .set({
          ...(parsed.data.altText !== undefined ? { altText: parsed.data.altText || null } : {}),
          ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption || null } : {}),
          ...(folder !== undefined ? { folder } : {}),
        })
        .where(and(eq(media.id, id), eq(media.siteId, existing.siteId)))
        .returning();
      if (!updated) throw Errors.notFound("Media not found");
      return { media: { ...updated, url: publicMediaUrl(updated.id) } };
    }
  );

  app.delete(
    "/api/admin/media/:id",
    { preHandler: requireJwt },
    async (req) => {
      const { id } = req.params as { id: string };
      const [existing] = await db
        .select({ id: media.id, siteId: media.siteId })
        .from(media)
        .where(eq(media.id, id))
        .limit(1);
      if (!existing) throw Errors.notFound("Media not found");
      await assertUserSiteRole(req, existing.siteId, "editor");

      await db.transaction(async (tx) => {
        const [locked] = await tx
          .select({ id: media.id, siteId: media.siteId, storageKey: media.storageKey })
          .from(media)
          .where(and(eq(media.id, id), eq(media.siteId, existing.siteId)))
          .limit(1)
          .for("update");
        if (!locked) throw Errors.notFound("Media not found");

        const usages = await tx
          .select({ id: mediaUsages.id })
          .from(mediaUsages)
          .where(eq(mediaUsages.mediaId, id))
          .limit(1);
        if (usages.length > 0) throw Errors.conflict("Media is in use — remove usages first");

        const pageRows = await tx
          .select({ rawContent: pages.rawContent, parsedSections: pages.parsedSections, blocks: pages.blocks, draftContent: pages.draftContent })
          .from(pages)
          .where(eq(pages.siteId, existing.siteId));
        const entryRows = await tx
          .select({ data: contentEntries.data })
          .from(contentEntries)
          .where(eq(contentEntries.siteId, existing.siteId));
        const settingRows = await tx
          .select({ value: siteSettings.value })
          .from(siteSettings)
          .where(eq(siteSettings.siteId, existing.siteId));
        const isReferenced = [...pageRows, ...entryRows, ...settingRows].some((row) => contentReferencesMedia(row, id, locked.storageKey));
        if (isReferenced) throw Errors.conflict("Media is referenced by page, content, or site settings; remove those references before deleting it");

        const [deleted] = await tx
          .delete(media)
          .where(and(eq(media.id, id), eq(media.siteId, existing.siteId)))
          .returning({ id: media.id });
        if (!deleted) throw Errors.notFound("Media not found");
        await tx.insert(events).values({
          siteId: existing.siteId,
          type: "media.delete",
          payload: { mediaId: id, storageKey: locked.storageKey },
        });
      });
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
      return { media: rows.map((asset) => ({ ...asset, url: publicMediaUrl(asset.id) })) };
    }
  );
}
