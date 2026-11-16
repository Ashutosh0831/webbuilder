import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = `https://${process.env.NEXT_PUBLIC_DOMAIN ?? "example.com"}`;
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${base}/sitemap.xml`,
  };
}