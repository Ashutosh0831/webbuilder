import { z } from "zod";

export const alignmentSchema = z.enum(["left", "center", "right"]).default("left");

export const spacingSchema = z.enum(["none", "sm", "md", "lg", "xl"]).default("md");

export const safeLinkSchema = z.string().refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}, "Enter an http(s) URL or a site-relative path");

export const imagePropsSchema = z.object({
  src: z.string().refine((value) => {
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter an http(s) image URL or a site-relative path"),
  alt: z.string().min(1).max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
