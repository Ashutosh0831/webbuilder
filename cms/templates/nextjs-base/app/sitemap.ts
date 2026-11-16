import type { MetadataRoute } from "next";
import { getEntries } from "@/lib/cms";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = `https://${process.env.NEXT_PUBLIC_DOMAIN ?? "example.com"}`;
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
        dynamicRoutes.push({ url: `${base}${path}`, lastModified: new Date() });
      }
    } catch {
      // ignore
    }
  }
  return [...staticRoutes, ...dynamicRoutes];
}