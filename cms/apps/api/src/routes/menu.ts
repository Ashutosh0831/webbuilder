import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { db, sites, menus, menuItems } from "@cms/db";
import { requireSuperAdmin, requireApiKey } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

const createMenuSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
});

const menuItemSchema = z.object({
  label: z.string().min(1).max(100),
  url: z.string().max(500).optional(),
  entryId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  position: z.number().int().min(0).optional(),
});

export async function menuRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/admin/sites/:siteId/menus",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const parsed = createMenuSchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }
      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.id, siteId))
        .limit(1);
      if (!site) throw Errors.notFound("Site not found");
      const [created] = await db
        .insert(menus)
        .values({ siteId, key: parsed.data.key, name: parsed.data.name })
        .returning();
      return { menu: created };
    }
  );

  app.get(
    "/api/admin/sites/:siteId/menus",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const rows = await db.select().from(menus).where(eq(menus.siteId, siteId));
      return { menus: rows };
    }
  );

  app.post(
    "/api/admin/menus/:menuId/items",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { menuId } = req.params as { menuId: string };
      const parsed = menuItemSchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }
      const [menu] = await db
        .select({ id: menus.id })
        .from(menus)
        .where(eq(menus.id, menuId))
        .limit(1);
      if (!menu) throw Errors.notFound("Menu not found");
      const [created] = await db
        .insert(menuItems)
        .values({
          menuId,
          label: parsed.data.label,
          url: parsed.data.url,
          entryId: parsed.data.entryId,
          parentId: parsed.data.parentId,
          position: parsed.data.position ?? 0,
        })
        .returning();
      return { item: created };
    }
  );

  // Public: resolved nav tree
  app.get(
    "/api/v1/sites/:siteSlug/menus/:menuKey",
    { preHandler: requireApiKey("read") },
    async (req) => {
      const { siteSlug, menuKey } = req.params as {
        siteSlug: string;
        menuKey: string;
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
      const [menu] = await db
        .select()
        .from(menus)
        .where(and(eq(menus.siteId, site.id), eq(menus.key, menuKey)))
        .limit(1);
      if (!menu) throw Errors.notFound("Menu not found");

      const items = await db
        .select()
        .from(menuItems)
        .where(eq(menuItems.menuId, menu.id))
        .orderBy(asc(menuItems.position));

      const tree: any[] = [];
      const byId: Record<string, any> = {};
      for (const item of items) {
        byId[item.id] = { ...item, children: [] };
      }
      for (const item of items) {
        if (item.parentId && byId[item.parentId]) {
          byId[item.parentId].children.push(byId[item.id]);
        } else {
          tree.push(byId[item.id]);
        }
      }
      return { menu: { key: menu.key, name: menu.name, items: tree } };
    }
  );
}