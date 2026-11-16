import type { MetadataRoute } from "next";
import { fetchServices, fetchLocations } from "@/lib/payload";
import { business } from "@/lib/business";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = business.url;
  const now = new Date();

  const staticPages = ["", "/about", "/contact"].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1.0 : 0.7,
  }));

  const services = await fetchServices();
  const servicePages = services.map((s: any) => ({
    url: `${base}/services/${s.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const locations = await fetchLocations();
  const locationPages = locations.map((l: any) => ({
    url: `${base}/locations/${l.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...servicePages, ...locationPages];
}