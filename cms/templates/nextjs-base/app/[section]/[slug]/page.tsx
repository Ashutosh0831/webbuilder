import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageSections from "@/components/PageSections";
import { getPageBySlug, getPublicSiteBaseUrl, getPublicSiteSettings } from "@/lib/cms";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildLocalBusinessJsonLd,
} from "@/lib/jsonld";

export async function generateMetadata({
  params,
}: {
  params: { section: string; slug: string };
}): Promise<Metadata> {
  try {
    const [page, settings, baseUrl] = await Promise.all([
      getPageBySlug(params.section, params.slug),
      getPublicSiteSettings(),
      getPublicSiteBaseUrl(),
    ]);

    const title = page.seo_title || page.title;
    const description =
      page.seo_description || settings.default_seo_description || settings.home_intro || "";
    const canonical =
      page.seo_canonical || `${baseUrl}/${params.section}/${params.slug}`;
    const ogImage = page.seo_og_image || settings.default_og_image || settings.home_hero_image_url;
    const robots = page.seo_robots || settings.default_robots || "index,follow";

    return {
      title,
      description,
      alternates: { canonical },
      robots,
      openGraph: {
        title,
        description,
        url: canonical,
        ...(ogImage ? { images: [{ url: ogImage }] } : {}),
      },
      twitter: {
        card: ogImage ? "summary_large_image" : "summary",
        title,
        description,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
    };
  } catch {
    return { title: "Page Not Found", robots: "noindex,nofollow" };
  }
}

export default async function DynamicSectionPage({
  params,
}: {
  params: { section: string; slug: string };
}) {
  let page: any;
  try {
    page = await getPageBySlug(params.section, params.slug);
  } catch {
    notFound();
  }

  const [settings, baseUrl] = await Promise.all([
    getPublicSiteSettings(),
    getPublicSiteBaseUrl(),
  ]);

  const canonical =
    page.seo_canonical || `${baseUrl}/${params.section}/${params.slug}`;
  const sections = Array.isArray(page.parsed_sections) ? page.parsed_sections : [];
  const faqLd = buildFaqJsonLd(sections);
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", url: baseUrl },
    { name: params.section, url: `${baseUrl}/${params.section}` },
    { name: page.title, url: canonical },
  ]);
  const businessLd = buildLocalBusinessJsonLd(settings, baseUrl);
  const articleLd =
    params.section === "blog" || params.section === "blogs"
      ? buildArticleJsonLd(page, settings, canonical)
      : null;
  const sectionLandingRoutes: Record<string, string> = {
    service: "/services", services: "/services",
    location: "/locations", locations: "/locations",
    blog: "/blog", blogs: "/blog", resource: "/blog", resources: "/blog",
    faq: "/faq", faqs: "/faq", contact: "/contact",
  };
  const sectionLanding = sectionLandingRoutes[params.section.toLowerCase()];

  return (
    <main className="container" style={{ padding: "32px 0" }}>
      <nav aria-label="Breadcrumb" style={{ fontSize: 14, marginBottom: 16 }}>
        <Link href="/">Home</Link> /{" "}
        {sectionLanding ? <Link href={sectionLanding}>{params.section}</Link> : <span>{params.section}</span>} /{" "}
        <span>{page.title}</span>
      </nav>

      <PageSections sections={sections} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}
      {articleLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
        />
      )}
    </main>
  );
}
