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
}

async function cmsFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "X-API-Key": KEY },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`CMS ${path}: ${res.status}`);
  return res.json() as Promise<T>;
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