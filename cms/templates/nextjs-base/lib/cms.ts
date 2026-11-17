const API = process.env.CMS_API_URL!;
const SITE = process.env.CMS_SITE_SLUG!;
const KEY = process.env.CMS_READ_KEY!;

export interface ContentEntry {
  id: string;
  slug: string;
  data: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
  seoCanonical?: string;
  updatedAt?: string | Date;
}

async function cmsFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "X-API-Key": KEY },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CMS ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

function normalizeSiteBaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password || url.search || url.hash) return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export interface PublicSiteSettings {
  public_url?: string;
  brand_name?: string;
  tagline?: string;
  announcement_text?: string;
  announcement_phone_label?: string;
  announcement_fallback_text?: string;
  nav_services_label?: string;
  nav_locations_label?: string;
  nav_resources_label?: string;
  nav_faq_label?: string;
  nav_more_label?: string;
  header_cta_label?: string;
  footer_note?: string;
  footer_explore_title?: string;
  footer_services_label?: string;
  footer_locations_label?: string;
  footer_resources_label?: string;
  footer_faq_label?: string;
  footer_contact_title?: string;
  footer_estimate_label?: string;
  footer_copyright_text?: string;
  home_heading?: string;
  home_intro?: string;
  home_cta_label?: string;
  logo_url?: string;
  home_hero_image_url?: string;
  home_hero_image_alt?: string;
  phone?: string;
  service_area?: string;
  area_name?: string;
  primary_color?: string;
  accent_color?: string;
  font_style?: string;
  facebook_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  contact_email?: string;
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const { settings } = await cmsFetch<{ settings: PublicSiteSettings }>(
      `/api/v1/sites/${SITE}/settings/public`
    );
    return settings ?? {};
  } catch {
    return {};
  }
}

export async function getPublicSiteBaseUrl(): Promise<string> {
  const settings = await getPublicSiteSettings();
  if (typeof settings.public_url === "string") {
    const configuredUrl = normalizeSiteBaseUrl(settings.public_url);
    if (configuredUrl) return configuredUrl;
  }

  const domain = process.env.NEXT_PUBLIC_DOMAIN ?? "example.com";
  return normalizeSiteBaseUrl(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`) ?? "https://example.com";
}

export async function getEntries(typeKey: string): Promise<ContentEntry[]> {
  const { entries } = await cmsFetch<{ entries: ContentEntry[] }>(
    `/api/v1/sites/${SITE}/content/${typeKey}`
  );
  return entries;
}

export async function getEntry(
  typeKey: string,
  slug: string
): Promise<{
  entry: ContentEntry;
  seo: {
    title: string;
    description: string;
    canonical: string;
    robots: string;
  };
  relations: Record<string, ContentEntry[]>;
}> {
  return cmsFetch(`/api/v1/sites/${SITE}/content/${typeKey}/${slug}`);
}

export async function getMenu(key: string) {
  const { menu } = await cmsFetch<any>(`/api/v1/sites/${SITE}/menus/${key}`);
  return menu;
}

export async function getForms() {
  const { forms } = await cmsFetch<{ forms: any[] }>(
    `/api/v1/sites/${SITE}/forms`
  );
  return forms;
}

export async function getForm(key: string) {
  const { form } = await cmsFetch<any>(`/api/v1/sites/${SITE}/forms/${key}`);
  return form;
}

export async function getAllPages() {
  try {
    const res = await cmsFetch<{ pages: any[] }>(
      `/api/v1/sites/${SITE}/pages`
    );
    // If the API returns undefined or missing pages, return an empty array
    return res?.pages || [];
  } catch (error) {
    console.error("Failed to fetch pages for navbar:", error);
    return [];
  }
}

export async function getPageBySlug(sectionKey: string, slug: string) {
  const { page } = await cmsFetch<{ page: any }>(`/api/v1/sites/${SITE}/pages/${sectionKey}/${slug}`);
  return page;
}
