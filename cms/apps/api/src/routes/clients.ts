import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, clients, sites, userClientAccess, userSiteAccess } from "@cms/db";
import { requireJwt, requireSuperAdmin } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
});

async function getAccessibleClientIds(userId: string): Promise<string[]> {
  const [owned, siteRows] = await Promise.all([
    db
      .select({ clientId: userClientAccess.clientId })
      .from(userClientAccess)
      .where(eq(userClientAccess.userId, userId)),
    db
      .select({ clientId: sites.clientId })
      .from(userSiteAccess)
      .innerJoin(sites, eq(sites.id, userSiteAccess.siteId))
      .where(eq(userSiteAccess.userId, userId)),
  ]);
  return [...new Set([...owned.map((r) => r.clientId), ...siteRows.map((r) => r.clientId)])];
}

export async function clientRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/admin/clients",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const parsed = createClientSchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }
      const [created] = await db.insert(clients).values(parsed.data).returning();
      return { client: created };
    }
  );

  app.get(
    "/api/admin/clients",
    { preHandler: requireJwt },
    async (req) => {
      if (req.user!.role === "super_admin") {
        const rows = await db.select().from(clients);
        return { clients: rows };
      }
      const ids = await getAccessibleClientIds(req.user!.sub);
      if (ids.length === 0) return { clients: [] };
      const rows = await db
        .select()
        .from(clients)
        .where(inArray(clients.id, ids));
      return { clients: rows };
    }
  );

  app.get(
    "/api/admin/clients/:id",
    { preHandler: requireJwt },
    async (req) => {
      const { id } = req.params as { id: string };
      if (req.user!.role !== "super_admin") {
        const ids = await getAccessibleClientIds(req.user!.sub);
        if (!ids.includes(id)) {
          throw Errors.forbidden("No access to this client");
        }
      }
      const [row] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, id))
        .limit(1);
      if (!row) throw Errors.notFound("Client not found");
      return { client: row };
    }
  );
}