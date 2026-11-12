import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveWebsiteByDomain } from "@/server/queries/public-website";
import { resolvePublishedPage } from "@/server/queries/public-page";
import { renderPage } from "@/features/components/renderer";
import { generatePageMetadata } from "@/server/seo/metadata";
import { generateThemeCssForWebsite } from "@/features/themes/generate-css";
import { defaultTokens } from "@/features/themes/default-tokens";
import { themeTokensSchema } from "@/lib/validations/themes";

interface PageProps {
  params: Promise<{ domain: string; slug?: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { domain, slug } = await params;
  const website = await resolveWebsiteByDomain(domain);
  if (!website) return { title: "Not Found" };

  const slugPath = slug?.join("/") ?? null;
  const resolved = await resolvePublishedPage(website.id, slugPath);
  if (!resolved) return { title: "Not Found" };

  return generatePageMetadata({
    website,
    page: resolved.page,
    domain,
    slug: slugPath,
  });
}

export default async function PublicPage({ params }: PageProps) {
  const { domain, slug } = await params;

  const website = await resolveWebsiteByDomain(domain);
  if (!website) notFound();

  const slugPath = slug?.join("/") ?? null;
  const resolved = await resolvePublishedPage(website.id, slugPath);
  if (!resolved) notFound();

  const sections = resolved.publishedContent.sections ?? [];
  const { nodes, errors } = renderPage(sections);

  if (errors.length > 0) {
    console.error("[public-render]", { websiteId: website.id, pageId: resolved.page.id, errors });
  }

  const theme = website.themes[0]?.theme;
  const parsed = themeTokensSchema.safeParse(theme?.tokens ?? {});
  const tokens = parsed.success ? parsed.data : defaultTokens;
  const themeCss = generateThemeCssForWebsite(tokens, website.id).replace(/</g, "\\3c ");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: website.name,
    url: `https://${domain}`,
  };
  const serializedJsonLd = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  // The root app layout owns <html> and <body>. Returning another pair here
  // would create invalid nested document elements in the App Router.
  return (
    <div
      lang={website.locale}
      data-theme={website.id}
      className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]"
    >
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializedJsonLd }}
      />
      <main>{nodes}</main>
    </div>
  );
}
