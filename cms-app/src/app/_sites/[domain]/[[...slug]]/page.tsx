import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveWebsiteByDomain } from "@/server/queries/public-website";
import { resolvePublishedPage } from "@/server/queries/public-page";
import { renderPage } from "@/features/components/renderer";
import { generatePageMetadata } from "@/server/seo/metadata";
import { ThemeStyles } from "@/features/themes/theme-styles";

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

  return (
    <html lang={website.locale}>
      <head>
        <ThemeStyles tokens={website.themes[0]?.theme.tokens ?? {}} />
      </head>
      <body>
        <main>{nodes}</main>
      </body>
    </html>
  );
}