import { resolveWebsiteByDomain } from "@/server/queries/public-website";
import { prisma } from "@/server/db/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;
  const website = await resolveWebsiteByDomain(domain);
  if (!website) return new Response("Not found", { status: 404 });

  const pages = await prisma.page.findMany({
    where: {
      websiteId: website.id,
      status: "PUBLISHED",
      deletedAt: null,
      publishedVersionId: { not: null },
    },
    select: { slug: true, updatedAt: true, isHomepage: true },
  });

  const base = `https://${domain}`;
  const urls = pages.map((p) => {
    const loc = p.isHomepage ? base : `${base}/${p.slug}`;
    return `<url><loc>${loc}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}