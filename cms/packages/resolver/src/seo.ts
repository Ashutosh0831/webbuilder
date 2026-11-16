import { interpolate, type InterpolationContext } from "./interpolate.js";

export interface SeoFallbackInput {
  manual: {
    title?: string | null;
    description?: string | null;
    canonical?: string | null;
    ogImage?: string | null;
    robots?: string | null;
  };
  template?: {
    titleTemplate?: string;
    descriptionTemplate?: string;
  } | null;
  siteDefaults: {
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoOgImage?: string | null;
    seoRobots?: string | null;
  };
  ctx: InterpolationContext;
  canonicalUrl: string;
}

export interface ResolvedSeo {
  title: string;
  description: string;
  canonical: string;
  ogImage: string | null;
  robots: string;
  sources: {
    title: "manual" | "template" | "site" | "fallback";
    description: "manual" | "template" | "site" | "fallback";
  };
}

/**
 * Resolve SEO fields through fallback chain:
 *   manual entry field → template → site default → hard fallback
 */
export function resolveSeo(input: SeoFallbackInput): ResolvedSeo {
  const { manual, template, siteDefaults, ctx, canonicalUrl } = input;

  // Title
  let title = manual.title?.trim() || "";
  let titleSource: ResolvedSeo["sources"]["title"] = "manual";
  if (!title && template?.titleTemplate) {
    title = interpolate(template.titleTemplate, ctx).resolved.trim();
    titleSource = "template";
  }
  if (!title && siteDefaults.seoTitle) {
    title = siteDefaults.seoTitle.trim();
    titleSource = "site";
  }
  if (!title) {
    title = "Untitled";
    titleSource = "fallback";
  }

  // Description
  let description = manual.description?.trim() || "";
  let descriptionSource: ResolvedSeo["sources"]["description"] = "manual";
  if (!description && template?.descriptionTemplate) {
    description = interpolate(template.descriptionTemplate, ctx).resolved.trim();
    descriptionSource = "template";
  }
  if (!description && siteDefaults.seoDescription) {
    description = siteDefaults.seoDescription.trim();
    descriptionSource = "site";
  }

  return {
    title,
    description,
    canonical: manual.canonical || canonicalUrl,
    ogImage: manual.ogImage || siteDefaults.seoOgImage || null,
    robots: manual.robots || siteDefaults.seoRobots || "index,follow",
    sources: { title: titleSource, description: descriptionSource },
  };
}