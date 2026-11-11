import { z } from "zod";

export const createWebsiteSchema = z.object({
  name: z
    .string()
    .min(1, "Website name is required")
    .max(100, "Name must be 100 characters or less"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be 50 characters or less")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    ),
  locale: z.enum(["en", "es", "fr", "de"]).default("en"),
});

export type CreateWebsiteInput = z.input<typeof createWebsiteSchema>;
export type CreateWebsiteOutput = z.output<typeof createWebsiteSchema>;