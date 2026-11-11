import { z } from "zod";

export const alignmentSchema = z.enum(["left", "center", "right"]).default("left");

export const spacingSchema = z.enum(["none", "sm", "md", "lg", "xl"]).default("md");

export const imagePropsSchema = z.object({
  src: z.string().url(),
  alt: z.string().max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
