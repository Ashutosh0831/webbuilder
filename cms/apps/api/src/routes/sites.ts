import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { db, sites, clients, apiKeys } from "@cms/db";
import { requireSuperAdmin } from "../middleware/auth.js";
import { generateApiKey, hashApiKey } from "../lib/crypto.js";
import { Errors } from "../lib/errors.js";

const PEPPER = process.env.API_KEY_PEPPER!;

const createSiteSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  siteSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  defaultLocale: z.string().min(2).max(10).optional(),
});

export async function siteRoutes(app: FastifyInstance): Promise<void> {
  // Create site + 3 API keys atomically
  app.post(
    "/api/admin/sites",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const parsed = createSiteSchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }

      const clientRow = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.id, parsed.data.clientId))
        .limit(1);
      if (clientRow.length === 0) throw Errors.notFound("Client not found");

      const { clientId, name, siteSlug, defaultLocale } = parsed.data;

      const readKey = generateApiKey();
      const writeKey = generateApiKey();
      const previewKey = generateApiKey();

      const site = await db.transaction(async (tx) => {
        const [createdSite] = await tx
          .insert(sites)
          .values({ clientId, name, siteSlug, defaultLocale: defaultLocale ?? "en" })
          .returning();

        await tx.insert(apiKeys).values([
          { siteId: createdSite.id, type: "read", keyHash: hashApiKey(readKey, PEPPER), label: "Initial read key" },
          { siteId: createdSite.id, type: "write", keyHash: hashApiKey(writeKey, PEPPER), label: "Initial write key" },
          { siteId: createdSite.id, type: "preview", keyHash: hashApiKey(previewKey, PEPPER), label: "Initial preview key" },
        ]);

        return createdSite;
      });

      return {
        site,
        keys: {
          read: readKey,
          write: writeKey,
          preview: previewKey,
        },
        warning: "Store these keys now. They are shown only once.",
      };
    }
  );

  // List sites (optionally filtered by client)
  app.get(
    "/api/admin/sites",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { clientId } = req.query as { clientId?: string };
      const rows = clientId
        ? await db.select().from(sites).where(eq(sites.clientId, clientId))
        : await db.select().from(sites);
      return { sites: rows };
    }
  );

  // Get one site
  app.get(
    "/api/admin/sites/:id",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
      const [row] = await db
        .select()
        .from(sites)
        .where(eq(sites.id, id))
        .limit(1);
      if (!row) throw Errors.notFound("Site not found");
      return { site: row };
    }
  );

  // Rotate an API key of a given type
  app.post(
    "/api/admin/sites/:id/keys/rotate",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = req.body as { type?: string };
      const type = body?.type;
      if (!type || !["read", "write", "preview"].includes(type)) {
        throw Errors.badRequest("type must be one of read, write, preview");
      }

      const siteRow = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.id, id))
        .limit(1);
      if (siteRow.length === 0) throw Errors.notFound("Site not found");

      const newKey = generateApiKey();
      await db.transaction(async (tx) => {
        await tx
          .update(apiKeys)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(apiKeys.siteId, id),
              eq(apiKeys.type, type as "read" | "write" | "preview"),
              isNull(apiKeys.revokedAt)
            )
          );

        await tx.insert(apiKeys).values({
          siteId: id,
          type: type as "read" | "write" | "preview",
          keyHash: hashApiKey(newKey, PEPPER),
          label: `Rotated ${type} key`,
        });
      });

      return { type, key: newKey, warning: "Store this key now. It is shown only once." };
    }
  );

  // List active keys metadata (not the keys themselves — those are not stored)
  app.get(
    "/api/admin/sites/:id/keys",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
      const rows = await db
        .select({
          id: apiKeys.id,
          type: apiKeys.type,
          label: apiKeys.label,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.siteId, id));
      return { keys: rows };
    }
  );
}
