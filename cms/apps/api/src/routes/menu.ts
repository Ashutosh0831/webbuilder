import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { db, sites, menus, menuItems, events, pages, contentEntries, contentTypes } from "@cms/db";
import {
  assertUserSiteRole,
  requireApiKey,
  requireJwt,
  requireSiteRole,
} from "../middleware/auth.js";
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
const updateMenuItemSchema = menuItemSchema.partial();

function isAllowedMenuUrl(value: string | undefined): boolean {
  if (value === undefined || value === "") return true;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

async function validateMenuParent(tx: any, menuId: string, parentId: string | undefined, itemId?: string) {
  if (!parentId) return;
  const siblings = await tx.select({ id: menuItems.id, parentId: menuItems.parentId })
    .from(menuItems).where(eq(menuItems.menuId, menuId));
  const byId = new Map<string, string | null>(siblings.map((item: { id: string; parentId: string | null }) => [item.id, item.parentId]));
  if (!byId.has(parentId)) throw Errors.badRequest("Parent item must belong to the same menu");
  let current: string | null | undefined = parentId;
  const visited = new Set<string>();
  while (current) {
    if (current === itemId) throw Errors.badRequest("A menu item cannot be nested beneath itself");
    if (visited.has(current)) throw Errors.conflict("The menu already contains a parent cycle; repair it before changing this item");
    visited.add(current);
    current = byId.get(current);
  }
}

async function validateInternalMenuTarget(tx: any, siteId: string, value: string | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) return;
  let pathname: string;
  try {
    const parsed = new URL(value, "https://internal.invalid");
    pathname = parsed.pathname.length > 1 ? parsed.pathname.replace(/\/$/, "") : "/";
  } catch {
    throw Errors.badRequest("Menu URL is not a valid site path");
  }
  const standardRoutes = new Set(["/", "/services", "/locations", "/blog", "/contact", "/faq"]);
  if (standardRoutes.has(pathname)) return;

  const publishedPages = await tx.select({ sectionKey: pages.sectionKey, slug: pages.slug })
    .from(pages).where(and(eq(pages.siteId, siteId), eq(pages.status, "published")));
  const routeForPage = (section: string, slug: string) => {
    const normalizedSection = section.toLowerCase();
    if (["home", "homepage"].includes(normalizedSection)) return "/";
    if (["service", "services"].includes(normalizedSection)) return `/services/${slug}`;
    if (["location", "locations"].includes(normalizedSection)) return `/locations/${slug}`;
    if (["blog", "blogs", "resource", "resources"].includes(normalizedSection)) return `/blog/${slug}`;
    if (["faq", "faqs"].includes(normalizedSection) && ["faq", "faqs", "frequently-asked-questions"].includes(slug)) return "/faq";
    if (normalizedSection === "contact" && ["contact", "contact-us"].includes(slug)) return "/contact";
    return `/${section}/${slug}`;
  };
  if (publishedPages.some((page: { sectionKey: string; slug: string }) => routeForPage(page.sectionKey, page.slug) === pathname)) return;

  const publishedEntries = await tx.select({ typeKey: contentTypes.key, slug: contentEntries.slug })
    .from(contentEntries).innerJoin(contentTypes, eq(contentEntries.contentTypeId, contentTypes.id))
    .where(and(eq(contentEntries.siteId, siteId), eq(contentEntries.status, "published")));
  const contentRoute = (type: string, slug: string) => {
    if (["service", "services"].includes(type)) return `/services/${slug}`;
    if (["location", "locations"].includes(type)) return `/locations/${slug}`;
    if (["blog", "blogs", "resource", "resources"].includes(type)) return `/blog/${slug}`;
    return null;
  };
  if (publishedEntries.some((entry: { typeKey: string; slug: string }) => contentRoute(entry.typeKey, entry.slug) === pathname)) return;
  throw Errors.badRequest(`No published page exists at ${pathname}`);
}

export async function menuRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/admin/sites/:siteId/menus",
    { preHandler: requireSiteRole("client_admin") },
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
      const [created] = await db.transaction(async (tx) => {
        const [menu] = await tx
          .insert(menus)
          .values({ siteId, key: parsed.data.key, name: parsed.data.name })
          .returning();
        await tx.insert(events).values({ siteId, type: "menu.updated", payload: { menuKey: menu.key } });
        return [menu];
      });
      return { menu: created };
    }
  );

  app.get(
    "/api/admin/sites/:siteId/menus",
    { preHandler: requireSiteRole("viewer") },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const rows = await db.select().from(menus).where(eq(menus.siteId, siteId));
      return { menus: rows };
    }
  );

  app.post(
    "/api/admin/menus/:menuId/items",
    { preHandler: requireJwt },
    async (req) => {
      const { menuId } = req.params as { menuId: string };
      const parsed = menuItemSchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }
      if (!isAllowedMenuUrl(parsed.data.url)) throw Errors.badRequest("Menu URLs must be site paths or HTTP(S) links");
      const [menu] = await db
        .select({ id: menus.id, siteId: menus.siteId, key: menus.key })
        .from(menus)
        .where(eq(menus.id, menuId))
        .limit(1);
      if (!menu) throw Errors.notFound("Menu not found");

      await assertUserSiteRole(req, menu.siteId, "client_admin");

      const [created] = await db.transaction(async (tx) => {
        await validateInternalMenuTarget(tx, menu.siteId, parsed.data.url);
        await validateMenuParent(tx, menuId, parsed.data.parentId);
        const [item] = await tx
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
        await tx.insert(events).values({ siteId: menu.siteId, type: "menu.updated", payload: { menuKey: menu.key } });
        return [item];
      });
      return { item: created };
    }
  );

  app.get(
    "/api/admin/menus/:menuId/items",
    { preHandler: requireJwt },
    async (req) => {
      const { menuId } = req.params as { menuId: string };
      const [menu] = await db.select({ id: menus.id, siteId: menus.siteId }).from(menus).where(eq(menus.id, menuId)).limit(1);
      if (!menu) throw Errors.notFound("Menu not found");
      await assertUserSiteRole(req, menu.siteId, "viewer");
      const items = await db.select().from(menuItems).where(eq(menuItems.menuId, menuId)).orderBy(asc(menuItems.position));
      return { items };
    }
  );

  app.patch(
    "/api/admin/menus/:menuId/items/:itemId",
    { preHandler: requireJwt },
    async (req) => {
      const { menuId, itemId } = req.params as { menuId: string; itemId: string };
      const parsed = updateMenuItemSchema.safeParse(req.body);
      if (!parsed.success) throw Errors.badRequest("Invalid menu item", parsed.error.flatten());
      if (!isAllowedMenuUrl(parsed.data.url)) throw Errors.badRequest("Menu URLs must be site paths or HTTP(S) links");
      const [menu] = await db.select({ siteId: menus.siteId, key: menus.key }).from(menus).where(eq(menus.id, menuId)).limit(1);
      if (!menu) throw Errors.notFound("Menu not found");
      await assertUserSiteRole(req, menu.siteId, "client_admin");
      if (parsed.data.parentId === itemId) throw Errors.badRequest("A menu item cannot be its own parent");
      const [item] = await db.transaction(async (tx) => {
        const [existing] = await tx.select({ id: menuItems.id }).from(menuItems)
          .where(and(eq(menuItems.id, itemId), eq(menuItems.menuId, menuId))).limit(1).for("update");
        if (!existing) throw Errors.notFound("Menu item not found");
        if (parsed.data.url !== undefined) await validateInternalMenuTarget(tx, menu.siteId, parsed.data.url);
        if (parsed.data.parentId !== undefined) await validateMenuParent(tx, menuId, parsed.data.parentId, itemId);
        const [updated] = await tx.update(menuItems).set(parsed.data).where(and(eq(menuItems.id, itemId), eq(menuItems.menuId, menuId))).returning();
        if (!updated) throw Errors.notFound("Menu item not found");
        await tx.insert(events).values({ siteId: menu.siteId, type: "menu.updated", payload: { menuKey: menu.key } });
        return [updated];
      });
      return { item };
    }
  );

  app.delete(
    "/api/admin/menus/:menuId/items/:itemId",
    { preHandler: requireJwt },
    async (req) => {
      const { menuId, itemId } = req.params as { menuId: string; itemId: string };
      const [menu] = await db.select({ siteId: menus.siteId, key: menus.key }).from(menus).where(eq(menus.id, menuId)).limit(1);
      if (!menu) throw Errors.notFound("Menu not found");
      await assertUserSiteRole(req, menu.siteId, "client_admin");
      await db.transaction(async (tx) => {
        await tx.update(menuItems).set({ parentId: null }).where(and(eq(menuItems.menuId, menuId), eq(menuItems.parentId, itemId)));
        const [item] = await tx.delete(menuItems).where(and(eq(menuItems.id, itemId), eq(menuItems.menuId, menuId))).returning({ id: menuItems.id });
        if (!item) throw Errors.notFound("Menu item not found");
        await tx.insert(events).values({ siteId: menu.siteId, type: "menu.updated", payload: { menuKey: menu.key } });
      });
      return { deleted: true };
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
