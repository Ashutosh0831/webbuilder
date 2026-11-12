import { z } from "zod";

export const spacingSchema = z.enum(["none", "sm", "md", "lg", "xl"]).default("md");
export const alignmentSchema = z.enum(["left", "center", "right"]).default("left");
export const colorTokenSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, "Color must be a theme token name")
  .default("foreground");

export const imagePropsSchema = z.object({
  src: z.string().url(),
  alt: z.string().min(1, "Alt text required for accessibility"),
  width: z.number().int().positive().max(4000).optional(),
  height: z.number().int().positive().max(4000).optional(),
});