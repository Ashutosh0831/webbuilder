import type { PublicSiteSettings } from "./cms";

export function buildLocalBusinessJsonLd(settings: PublicSiteSettings, baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: settings.brand_name || "Local Service Company",
    url: baseUrl,
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.contact_email ? { email: settings.contact_email } : {}),
    ...(settings.address ? { address: settings.address } : {}),
    ...(settings.service_area ? { areaServed: settings.service_area } : {}),
    ...(settings.logo_url ? { logo: settings.logo_url } : {}),
  };
}

export function buildFaqJsonLd(sections: any[]) {
  const items = sections
    .filter((s) => s?.type === "faqs")
    .flatMap((s) => s.data?.items ?? [])
    .filter((i: any) => i?.question && i?.answer);

  if (items.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item: { question: string; answer: string }) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildArticleJsonLd(page: any, settings: PublicSiteSettings, canonicalUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.seo_title || page.title,
    description: page.seo_description || "",
    url: canonicalUrl,
    ...(page.published_at ? { datePublished: page.published_at } : {}),
    ...(page.updated_at ? { dateModified: page.updated_at } : {}),
    publisher: {
      "@type": "Organization",
      name: settings.brand_name || "Local Service Company",
    },
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
