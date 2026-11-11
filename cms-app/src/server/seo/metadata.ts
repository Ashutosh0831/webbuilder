import type { Metadata } from "next";
import type { Website, Page } from "@/generated/prisma/client";

interface MetadataInput {
  website: Website & { settings: { defaultSeo: unknown } | null };
  page: Page;
  domain: string;
  slug: string | null;
}

export function generatePageMetadata({ website, page, domain, slug }: MetadataInput): Metadata {
  const pageSeo = (page.seo ?? {}) as {
    title?: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    noindex?: boolean;
  };

  const websiteDefaults = (website.settings?.defaultSeo ?? {}) as {
    titleTemplate?: string;
    defaultDescription?: string;
  };

  const title = pageSeo.title ?? page.title;
  const description = pageSeo.description ?? websiteDefaults.defaultDescription ?? "";
  const canonical = `https://${domain}${slug ? `/${slug}` : ""}`;

  const ogTitle = pageSeo.ogTitle ?? title;
  const ogDescription = pageSeo.ogDescription ?? description;

  return {
    title: websiteDefaults.titleTemplate
      ? websiteDefaults.titleTemplate.replace("%s", title)
      : title,
    description,
    alternates: { canonical },
    robots: pageSeo.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      siteName: website.name,
      locale: website.locale,
      type: "website",
      ...(pageSeo.ogImage && { images: [{ url: pageSeo.ogImage }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      ...(pageSeo.ogImage && { images: [pageSeo.ogImage] }),
    },
  };
}