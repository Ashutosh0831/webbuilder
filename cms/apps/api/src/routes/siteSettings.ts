import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, sites, siteSettings } from "@cms/db";
import { requireApiKey, requireSuperAdmin } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

const settingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
});

const bulkSettingsSchema = z.object({
  settings: z.array(settingSchema),
});

export async function siteSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/v1/sites/:siteSlug/settings/public",
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
        .select({ key: siteSettings.key, value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.siteId, site.id));
      const publicKeys = new Set(["public_url", "brand_name", "tagline", "announcement_text", "announcement_phone_label", "announcement_fallback_text", "nav_services_label", "nav_locations_label", "nav_resources_label", "nav_faq_label", "nav_more_label", "header_cta_label", "footer_note", "footer_explore_title", "footer_services_label", "footer_locations_label", "footer_resources_label", "footer_faq_label", "footer_contact_title", "footer_estimate_label", "footer_copyright_text", "home_heading", "home_intro", "home_cta_label", "logo_url", "home_hero_image_url", "home_hero_image_alt", "phone", "contact_email", "service_area", "area_name", "facebook_url", "instagram_url", "linkedin_url", "primary_color", "accent_color", "font_style"]);
      const settings: Record<string, unknown> = {};
      for (const row of rows) {
        if (publicKeys.has(row.key)) settings[row.key] = row.value;
      }
      return { settings };
    }
  );

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

      await db.transaction(async (tx) => {
        for (const item of parsed.data.settings) {
          await tx
            .insert(siteSettings)
            .values({ siteId, key: item.key, value: item.value })
            .onConflictDoUpdate({
              target: [siteSettings.siteId, siteSettings.key],
              set: { value: item.value, updatedAt: new Date() },
            });
        }
      });

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
