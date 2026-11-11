import { z } from "zod";

export const websiteSlugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(50, "Slug must be 50 characters or less")
  .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only")
  .refine((s) => !["admin", "api", "www", "sitemap", "robots"].includes(s), {
    message: "This slug is reserved",
  });

export const createWebsiteSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string().min(1, "Name required").max(100),
  slug: websiteSlugSchema,
  description: z.string().max(500).optional(),
  locale: z.enum(["en", "es", "fr", "de"]).default("en"),
  timezone: z.string().default("UTC"),
});

export const updateWebsiteSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  locale: z.enum(["en", "es", "fr", "de"]).optional(),
  timezone: z.string().optional(),
});

export const websiteFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});