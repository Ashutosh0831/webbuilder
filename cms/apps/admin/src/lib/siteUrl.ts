export function normalizePublicSiteUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password || url.search || url.hash) return "";
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${path}`;
  } catch {
    return "";
  }
}

export function buildPublicPageUrl(baseUrl: string, sectionKey: string, slug: string): string {
  return `${baseUrl}/${encodeURIComponent(sectionKey)}/${encodeURIComponent(slug)}`;
}
