import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, sites, siteSettings } from "@cms/db";
import { requireSuperAdmin } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

const settingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
});

const bulkSettingsSchema = z.object({
  settings: z.array(settingSchema),
});

export async function siteSettingsRoutes(app: FastifyInstance): Promise<void> {
  // Set multiple settings at once (upsert)
  app.put(
    "/api/admin/sites/:siteId/settings",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const parsed = bulkSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }

      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.id, siteId))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");

      for (const item of parsed.data.settings) {
        const [existing] = await db
          .select({ id: siteSettings.id })
          .from(siteSettings)
          .where(
            and(
              eq(siteSettings.siteId, siteId),
              eq(siteSettings.key, item.key)
            )
          )
          .limit(1);

        if (existing) {
          await db
            .update(siteSettings)
            .set({ value: item.value, updatedAt: new Date() })
            .where(eq(siteSettings.id, existing.id));
        } else {
          await db
            .insert(siteSettings)
            .values({ siteId, key: item.key, value: item.value });
        }
      }

      return { ok: true, count: parsed.data.settings.length };
    }
  );

  // List all settings
  app.get(
    "/api/admin/sites/:siteId/settings",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const rows = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.siteId, siteId));
      return { settings: rows };
    }
  );

  // Delete a setting
  app.delete(
    "/api/admin/sites/:siteId/settings/:key",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId, key } = req.params as { siteId: string; key: string };
      const [deleted] = await db
        .delete(siteSettings)
        .where(
          and(eq(siteSettings.siteId, siteId), eq(siteSettings.key, key))
        )
        .returning({ id: siteSettings.id });
      if (!deleted) throw Errors.notFound("Setting not found");
      return { deleted: true };
    }
  );
}