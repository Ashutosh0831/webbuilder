import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { db, sites, forms, formSubmissions, events } from "@cms/db";
import { requireSuperAdmin, requireApiKey } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

const createFormSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  schema: z.object({
    fields: z.array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        type: z.enum(["text", "email", "tel", "textarea", "select", "checkbox"]),
        required: z.boolean().optional(),
        options: z.array(z.string()).optional(),
      })
    ),
  }),
  settings: z.record(z.any()).optional(),
});

export async function formRoutes(app: FastifyInstance): Promise<void> {
  // Admin: create form
  app.post(
    "/api/admin/sites/:siteId/forms",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const parsed = createFormSchema.safeParse(req.body);
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
        .insert(forms)
        .values({
          siteId,
          key: parsed.data.key,
          name: parsed.data.name,
          schema: parsed.data.schema,
          settings: parsed.data.settings ?? {},
        })
        .returning();
      return { form: created };
    }
  );

  app.get(
    "/api/admin/sites/:siteId/forms",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const rows = await db.select().from(forms).where(eq(forms.siteId, siteId));
      return { forms: rows };
    }
  );

  // Admin: list submissions
  app.get(
    "/api/admin/sites/:siteId/submissions",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const q = req.query as { formId?: string };
      let query = db
        .select()
        .from(formSubmissions)
        .where(eq(formSubmissions.siteId, siteId))
        .$dynamic();
      if (q.formId) {
        query = query.where(
          and(
            eq(formSubmissions.siteId, siteId),
            eq(formSubmissions.formId, q.formId)
          )
        );
      }
      const rows = await query.orderBy(desc(formSubmissions.createdAt));
      return { submissions: rows };
    }
  );

  // Public: get form schema
  app.get(
    "/api/v1/sites/:siteSlug/forms/:key",
    { preHandler: requireApiKey("read") },
    async (req) => {
      const { siteSlug, key } = req.params as {
        siteSlug: string;
        key: string;
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
      const [form] = await db
        .select()
        .from(forms)
        .where(and(eq(forms.siteId, site.id), eq(forms.key, key)))
        .limit(1);
      if (!form) throw Errors.notFound("Form not found");
      return { form: { key: form.key, name: form.name, schema: form.schema } };
    }
  );

  // Public: submit form (read key required + honeypot)
  app.post(
    "/api/v1/sites/:siteSlug/forms/:key/submit",
    { preHandler: requireApiKey("read") },
    async (req) => {
      const { siteSlug, key } = req.params as {
        siteSlug: string;
        key: string;
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
      const [form] = await db
        .select()
        .from(forms)
        .where(and(eq(forms.siteId, site.id), eq(forms.key, key)))
        .limit(1);
      if (!form) throw Errors.notFound("Form not found");

      const body = req.body as Record<string, unknown> | undefined;
      if (!body || typeof body !== "object") {
        throw Errors.badRequest("Invalid submission");
      }

      // Honeypot: if "_hp" field has any value, silently accept but mark as spam
      const isSpam = Boolean((body as any)._hp);

      const [created] = await db
        .insert(formSubmissions)
        .values({
          siteId: site.id,
          formId: form.id,
          data: body,
          ip: req.ip,
          userAgent: req.headers["user-agent"] ?? null,
          status: isSpam ? "spam" : "new",
        })
        .returning();

      if (!isSpam) {
        await db.insert(events).values({
          siteId: site.id,
          type: "form.submitted",
          payload: {
            submissionId: created.id,
            formKey: form.key,
            formName: form.name,
          },
        });
      }

      return { ok: true, submissionId: created.id };
    }
  );
}