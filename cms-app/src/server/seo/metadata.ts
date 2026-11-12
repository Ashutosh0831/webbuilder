import type { Metadata } from "next";
import type { Website, Page } from "@/generated/prisma/client";

interface MetadataInput {
  website: Pick<Website, "name" | "locale"> & {
    settings: { defaultSeo: unknown } | null;
  };
  page: Pick<Page, "title" | "seo">;
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
  const ogImage = pageSeo.ogImage;
  const image = ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined;

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
      ...(image && { images: image }),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      ...(ogImage && { images: [ogImage] }),
    },
  };
}