import { z } from "zod";

export const pageSlugSchema = z
  .string()
  .min(1, "Slug required")
  .max(80, "Slug must be 80 characters or less")
  .regex(/^[a-z0-9-/]*$/, "Lowercase letters, numbers, hyphens, and slashes only")
  .refine((s) => !s.startsWith("/") && !s.endsWith("/"), {
    message: "Slug must not start or end with a slash",
  });

export const pageSeoSchema = z.object({
  title: z.string().max(60).optional(),
  description: z.string().max(160).optional(),
  ogTitle: z.string().max(60).optional(),
  ogDescription: z.string().max(160).optional(),
  ogImage: z.string().url().optional(),
  noindex: z.boolean().default(false),
});

export const pageSectionSchema = z.object({
  id: z.string().uuid(),
  componentType: z.string().min(1),
  props: z.record(z.string(), z.unknown()),
  sortOrder: z.number().int().min(0),
});

export const pageContentSchema = z.object({
  sections: z.array(pageSectionSchema),
});

export const createPageSchema = z.object({
  websiteId: z.string().uuid(),
  title: z.string().min(1, "Title required").max(200),
  slug: pageSlugSchema,
  parentId: z.string().uuid().nullable().optional(),
  seo: pageSeoSchema.optional(),
});

export const updatePageSchema = z.object({
  id: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
  title: z.string().min(1).max(200).optional(),
  slug: pageSlugSchema.optional(),
  seo: pageSeoSchema.optional(),
  content: pageContentSchema.optional(),
});

export const restorePageVersionSchema = z.object({
  pageId: z.string().uuid(),
  versionId: z.string().uuid(),
  websiteId: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
});

export const pageFilterSchema = z.object({
  websiteId: z.string().uuid(),
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "SCHEDULED", "ARCHIVED"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});