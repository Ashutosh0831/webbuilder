import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface GenerateOptions {
  siteSlug: string;
  stack: string;
  apiBaseUrl: string;
}

async function fetchJson<T>(url: string, key: string): Promise<T | null> {
  const res = await fetch(url, { headers: { "X-API-Key": key } });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`${url} → ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function generate(opts: GenerateOptions): Promise<void> {
  if (!/^[a-z0-9-]{1,100}$/.test(opts.siteSlug)) {
    throw new Error("siteSlug must contain only lowercase letters, numbers, and hyphens");
  }
  if (!/^[a-z0-9-]+$/.test(opts.stack)) {
    throw new Error("stack must contain only lowercase letters, numbers, and hyphens");
  }
  let apiBaseUrl: string;
  try {
    const url = new URL(opts.apiBaseUrl);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      throw new Error();
    }
    apiBaseUrl = url.toString().replace(/\/+$/, "");
  } catch {
    throw new Error("apiBaseUrl must be a valid HTTP or HTTPS URL");
  }

  const readKey = process.env.GENERATOR_READ_KEY ?? "";
  if (!readKey) {
    throw new Error(
      "GENERATOR_READ_KEY is required in .env (the site's read API key)"
    );
  }

  console.log(`[generator] fetching data for site "${opts.siteSlug}"...`);

  // Fetch the new pages
  const pagesRes = await fetchJson<{ pages?: any[] }>(
    `${apiBaseUrl}/api/v1/sites/${opts.siteSlug}/pages`,
    readKey
  );
  const pages = pagesRes?.pages ?? [];

  const templatesRoot = path.resolve(__dirname, "../../../templates");
  const templateName = `${opts.stack}-base`;
  const availableTemplates = await fs.readdir(templatesRoot, { withFileTypes: true });
  if (!availableTemplates.some((entry) => entry.isDirectory() && entry.name === templateName)) {
    const stacks = availableTemplates
      .filter((entry) => entry.isDirectory() && entry.name.endsWith("-base"))
      .map((entry) => entry.name.slice(0, -5));
    throw new Error(`Unsupported stack "${opts.stack}". Available: ${stacks.join(", ") || "none"}`);
  }
  const templateDir = path.join(templatesRoot, templateName);
  const outDir = path.resolve(
    __dirname,
    "../../../generated",
    opts.siteSlug
  );

  console.log(`[generator] copying template ${templateDir} → ${outDir}...`);
  let existingEnv = "";
  try {
    existingEnv = await fs.readFile(path.join(outDir, ".env.local"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await fs.mkdir(outDir, { recursive: true });
  await copyDir(templateDir, outDir);

  // Refresh generated values while preserving local settings such as NEXT_PUBLIC_DOMAIN.
  const envLocal = mergeEnv(existingEnv, {
    CMS_API_URL: apiBaseUrl,
    CMS_SITE_SLUG: opts.siteSlug,
    CMS_READ_KEY: readKey,
    NEXT_PUBLIC_CMS_API_URL: apiBaseUrl,
    NEXT_PUBLIC_CMS_SITE_SLUG: opts.siteSlug,
    NEXT_PUBLIC_CMS_READ_KEY: readKey,
    NEXT_PUBLIC_SITE_NAME: opts.siteSlug,
  });
  await fs.writeFile(path.join(outDir, ".env.local"), envLocal);

  // Write a bundle.json so the site has the data statically if needed
  await fs.writeFile(
    path.join(outDir, "cms-bundle.json"),
    JSON.stringify({ pages }, null, 2)
  );

  console.log(`[generator] ✓ generated at ${outDir}`);
  console.log(`[generator] next: cd ${outDir} && pnpm install && pnpm dev`);
}

function mergeEnv(existing: string, updates: Record<string, string>): string {
  const remaining = new Map(Object.entries(updates));
  const lines = existing.split(/\r?\n/);
  const merged = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || !remaining.has(match[1])) return line;
    const value = remaining.get(match[1])!;
    remaining.delete(match[1]);
    return `${match[1]}=${value}`;
  });

  while (merged.length && merged[merged.length - 1] === "") merged.pop();
  merged.push(...[...remaining].map(([key, value]) => `${key}=${value}`));
  return `${merged.join("\n")}\n`;
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
