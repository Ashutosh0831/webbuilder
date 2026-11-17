import type { MetadataRoute } from "next";
import { getPublicSiteBaseUrl } from "@/lib/cms";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getPublicSiteBaseUrl();
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${base}/sitemap.xml`,
  };
}
