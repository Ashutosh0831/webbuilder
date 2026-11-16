import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface GenerateOptions {
  siteSlug: string;
  stack: string;
  apiBaseUrl: string;
}

interface SiteBundle {
  site: { id: string; name: string; siteSlug: string; defaultLocale: string };
  settings: Record<string, unknown>;
  contentTypes: any[];
  entriesByType: Record<string, any[]>;
  menus: Record<string, any>;
  forms: any[];
  theme: { base: string; tokens: Record<string, string> };
}

async function fetchSiteBundle(
  apiBaseUrl: string,
  siteSlug: string,
  readKey: string
): Promise<SiteBundle> {
  const h = { "X-API-Key": readKey };

  const fetchJson = async (url: string) => {
    const res = await fetch(url, { headers: h });
    if (!res.ok) {
      throw new Error(`${url} → ${res.status}: ${await res.text()}`);
    }
    return res.json();
  };

  // Fetch settings via a stub if admin-only — for now, generate defaults from DB
  // Real settings endpoint is admin-only; use the DB for generation-time settings
  // For Batch 8, settings will come from a helper file generated at request time
  const site = { id: "", name: "", siteSlug, defaultLocale: "en" };

  const typesRes = await fetchJson(
    `${apiBaseUrl}/api/v1/sites/${siteSlug}/content-types`
  );
  const contentTypes = typesRes.contentTypes;

  const entriesByType: Record<string, any[]> = {};
  for (const ct of contentTypes) {
    try {
      const listRes = await fetchJson(
        `${apiBaseUrl}/api/v1/sites/${siteSlug}/content/${ct.key}`
      );
      entriesByType[ct.key] = listRes.entries;
    } catch {
      entriesByType[ct.key] = [];
    }
  }

  const menus: Record<string, any> = {};
  try {
    menus.header = await fetchJson(
      `${apiBaseUrl}/api/v1/sites/${siteSlug}/menus/header`
    );
  } catch {
    menus.header = { menu: { items: [] } };
  }

  const formsRes = await fetchJson(
    `${apiBaseUrl}/api/v1/sites/${siteSlug}/forms`
  ).catch(() => ({ forms: [] }));

  return {
    site,
    settings: {},
    contentTypes,
    entriesByType,
    menus,
    forms: formsRes.forms ?? [],
    theme: { base: "professional-blue", tokens: {} },
  };
}

export async function generate(opts: GenerateOptions): Promise<void> {
  const readKey = process.env.GENERATOR_READ_KEY ?? "";
  if (!readKey) {
    throw new Error(
      "GENERATOR_READ_KEY is required in .env (the site's read API key)"
    );
  }

  console.log(`[generator] fetching bundle for site "${opts.siteSlug}"...`);
  const bundle = await fetchSiteBundle(opts.apiBaseUrl, opts.siteSlug, readKey);

  const templateDir = path.resolve(
    __dirname,
    "../../../templates",
    `${opts.stack}-base`
  );
  const outDir = path.resolve(
    __dirname,
    "../../../generated",
    opts.siteSlug
  );

  console.log(`[generator] copying template ${templateDir} → ${outDir}...`);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  await copyDir(templateDir, outDir);

  // Write .env.local with site config
  const envLocal = [
    `CMS_API_URL=${opts.apiBaseUrl}`,
    `CMS_SITE_SLUG=${opts.siteSlug}`,
    `CMS_READ_KEY=${readKey}`,
    `NEXT_PUBLIC_SITE_NAME=${bundle.site.name || opts.siteSlug}`,
  ].join("\n");
  await fs.writeFile(path.join(outDir, ".env.local"), envLocal);

  // Write bundle.json for static generation
  await fs.writeFile(
    path.join(outDir, "cms-bundle.json"),
    JSON.stringify(bundle, null, 2)
  );

  console.log(`[generator] ✓ generated at ${outDir}`);
  console.log(`[generator] next: cd ${outDir} && pnpm install && pnpm dev`);
}

async function copyDir(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}