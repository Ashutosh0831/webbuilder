import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  sites,
  contentEntries,
  contentTypes,
  contentRelations,
} from "@cms/db";
import { requireSuperAdmin, requireApiKey } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

const relationSchema = z.object({
  fromEntryId: z.string().uuid(),
  toEntryId: z.string().uuid(),
  relationType: z.string().min(1).max(50),
  position: z.number().int().min(0).optional(),
});

export async function relationRoutes(app: FastifyInstance): Promise<void> {
  // Create a relation
  app.post(
    "/api/admin/relations",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const parsed = relationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }
      const [from] = await db
        .select({ siteId: contentEntries.siteId })
        .from(contentEntries)
        .where(eq(contentEntries.id, parsed.data.fromEntryId))
        .limit(1);
      if (!from) throw Errors.notFound("From entry not found");
      const [to] = await db
        .select({ siteId: contentEntries.siteId })
        .from(contentEntries)
        .where(eq(contentEntries.id, parsed.data.toEntryId))
        .limit(1);
      if (!to) throw Errors.notFound("To entry not found");
      if (from.siteId !== to.siteId) {
        throw Errors.badRequest("Relations must be within the same site");
      }
      const [created] = await db
        .insert(contentRelations)
        .values({
          fromEntryId: parsed.data.fromEntryId,
          toEntryId: parsed.data.toEntryId,
          relationType: parsed.data.relationType,
          position: parsed.data.position ?? 0,
        })
        .returning();
      return { relation: created };
    }
  );

  app.delete(
    "/api/admin/relations/:id",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
      const [deleted] = await db
        .delete(contentRelations)
        .where(eq(contentRelations.id, id))
        .returning({ id: contentRelations.id });
      if (!deleted) throw Errors.notFound("Relation not found");
      return { deleted: true };
    }
  );

  // List relations for an entry
  app.get(
    "/api/admin/content/:entryId/relations",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { entryId } = req.params as { entryId: string };
      const rows = await db
        .select()
        .from(contentRelations)
        .where(eq(contentRelations.fromEntryId, entryId));
      return { relations: rows };
    }
  );
}