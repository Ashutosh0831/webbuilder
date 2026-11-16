import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db, sites, contentTypes } from "@cms/db";
import { requireSuperAdmin } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

const fieldSchemaZ = z.object({
  fields: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      type: z.enum([
        "text",
        "textarea",
        "richtext",
        "number",
        "boolean",
        "date",
        "media",
        "select",
        "repeater",
      ]),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
  ),
  seo: z.boolean().optional(),
  templateEnabled: z.boolean().optional(),
});

const createContentTypeSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/),
  label: z.string().min(1).max(100),
  fieldSchema: fieldSchemaZ,
  urlEnabled: z.boolean().optional(),
  templateEnabled: z.boolean().optional(),
});

export async function contentTypeRoutes(app: FastifyInstance): Promise<void> {
  // Create a content type for a specific site
  app.post(
    "/api/admin/sites/:siteId/content-types",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const parsed = createContentTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }

      const siteRow = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.id, siteId))
        .limit(1);
      if (siteRow.length === 0) throw Errors.notFound("Site not found");

      // Check for duplicate key per site
      const existing = await db
        .select({ id: contentTypes.id })
        .from(contentTypes)
        .where(
          and(eq(contentTypes.siteId, siteId), eq(contentTypes.key, parsed.data.key))
        )
        .limit(1);
      if (existing.length > 0) {
        throw Errors.conflict(`Content type '${parsed.data.key}' already exists for this site`);
      }

      const [created] = await db
        .insert(contentTypes)
        .values({
          siteId,
          key: parsed.data.key,
          label: parsed.data.label,
          fieldSchema: parsed.data.fieldSchema,
          urlEnabled: parsed.data.urlEnabled ?? false,
          templateEnabled: parsed.data.templateEnabled ?? true,
        })
        .returning();

      return { contentType: created };
    }
  );

  // List content types for a site
  app.get(
    "/api/admin/sites/:siteId/content-types",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const rows = await db
        .select()
        .from(contentTypes)
        .where(eq(contentTypes.siteId, siteId));
      return { contentTypes: rows };
    }
  );

  // Get one content type
  app.get(
    "/api/admin/content-types/:id",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { id } = req.params as { id: string };
      const [row] = await db
        .select()
        .from(contentTypes)
        .where(eq(contentTypes.id, id))
        .limit(1);
      if (!row) throw Errors.notFound("Content type not found");
      return { contentType: row };
    }
  );
}