import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, clients } from "@cms/db";
import { requireSuperAdmin } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
});

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
    { preHandler: requireSuperAdmin },
    async () => {
      const rows = await db.select().from(clients);
      return { clients: rows };
    }
  );

  app.get(
    "/api/admin/clients/:id",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
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