export function pagePathForSection(sectionKey: string, slug: string): string {
  const section = sectionKey.toLowerCase();
  const safeSlug = encodeURIComponent(slug);
  if (["home", "homepage"].includes(section)) return "/";
  if (["service", "services"].includes(section)) return `/services/${safeSlug}`;
  if (["location", "locations"].includes(section)) return `/locations/${safeSlug}`;
  if (["blog", "blogs", "resource", "resources"].includes(section)) return `/blog/${safeSlug}`;
  if (["faq", "faqs"].includes(section) && ["faq", "faqs", "frequently-asked-questions"].includes(slug)) return "/faq";
  if (section === "contact" && ["contact", "contact-us"].includes(slug)) return "/contact";
  return `/${encodeURIComponent(sectionKey)}/${safeSlug}`;
}
