import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { db, sites, forms, formSubmissions, events } from "@cms/db";
import { requireSuperAdmin, requireApiKey } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

function normalizeJsonb(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function validateSubmission(
  schemaValue: unknown,
  payload: unknown
): { data: Record<string, unknown>; isSpam: boolean } {
  const parsedPayload = z.record(z.unknown()).safeParse(payload);
  if (!parsedPayload.success) throw Errors.badRequest("Invalid submission");

  const parsedSchema = createFormSchema.shape.schema.safeParse(normalizeJsonb(schemaValue));
  if (!parsedSchema.success) {
    throw Errors.badRequest("Form schema is invalid");
  }

  const body = parsedPayload.data;
  const fields = parsedSchema.data.fields;
  const allowedKeys = new Set(fields.map((field) => field.key));
  allowedKeys.add("_hp");
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw Errors.badRequest("Submission contains an unknown field");
  }
  if (body._hp !== undefined && typeof body._hp !== "string") {
    throw Errors.badRequest("Invalid submission");
  }

  const data: Record<string, unknown> = { _hp: body._hp ?? "" };
  for (const field of fields) {
    const value = body[field.key];
    if (field.type === "checkbox") {
      if (value === undefined) {
        if (field.required) throw Errors.badRequest(`${field.label} is required`);
        data[field.key] = false;
        continue;
      }
      if (typeof value !== "boolean") {
        throw Errors.badRequest(`${field.label} must be a checkbox value`);
      }
      if (field.required && !value) throw Errors.badRequest(`${field.label} is required`);
      data[field.key] = value;
      continue;
    }

    if (value === undefined && field.required) {
      throw Errors.badRequest(`${field.label} is required`);
    }
    if (value === undefined) {
      data[field.key] = "";
      continue;
    }
    if (typeof value !== "string") {
      throw Errors.badRequest(`${field.label} must be text`);
    }
    if (value.length > 10000) throw Errors.badRequest(`${field.label} is too long`);
    if (field.required && !value.trim()) {
      throw Errors.badRequest(`${field.label} is required`);
    }
    if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw Errors.badRequest(`${field.label} must be a valid email address`);
    }
    if (field.type === "select" && value && !field.options?.includes(value)) {
      throw Errors.badRequest(`${field.label} has an invalid selection`);
    }
    data[field.key] = value;
  }

  return { data, isSpam: Boolean(body._hp) };
}

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
  // ─── ADMIN ──────────────────────────────

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

  // ─── PUBLIC ──────────────────────────────

  // List all forms for a site
  app.get(
    "/api/v1/sites/:siteSlug/forms",
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
        .select()
        .from(forms)
        .where(eq(forms.siteId, site.id));
      return {
        forms: rows.map((f) => ({
          key: f.key,
          name: f.name,
          schema: f.schema,
        })),
      };
    }
  );

  // Get a single form schema by key
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

  // Submit a form (honeypot-based spam protection)
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

      const { data, isSpam } = validateSubmission(form.schema, req.body);

      const [created] = await db
        .insert(formSubmissions)
        .values({
          siteId: site.id,
          formId: form.id,
          data,
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
