import type { MetadataRoute } from "next";
import { getAllPages, getEntries, getPublicSiteBaseUrl } from "@/lib/cms";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await getPublicSiteBaseUrl();
  const staticRoutes = ["/", "/blog", "/faq", "/contact"].map((r) => ({
    url: `${base}${r}`,
    lastModified: new Date(),
  }));

  const dynamicRoutes: MetadataRoute.Sitemap = [];
  for (const type of ["service", "blog", "location"]) {
    try {
      const entries = await getEntries(type);
      for (const e of entries) {
        const path =
          type === "service"
            ? `/services/${e.slug}`
            : type === "blog"
            ? `/blog/${e.slug}`
            : `/locations/${e.slug}`;
        dynamicRoutes.push({ url: `${base}${path}`, lastModified: e.updatedAt ? new Date(e.updatedAt) : new Date() });
      }
    } catch {
      // ignore
    }
  }
  const pages = await getAllPages();
  for (const page of pages) {
    if (!page.section_key || !page.slug) continue;
    dynamicRoutes.push({
      url: `${base}/${page.section_key}/${page.slug}`,
      lastModified: page.updated_at ? new Date(page.updated_at) : new Date(),
    });
  }

  const uniqueRoutes = new Map([...staticRoutes, ...dynamicRoutes].map((route) => [route.url, route]));
  return [...uniqueRoutes.values()];
}
