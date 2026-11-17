import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface GenerateOptions {
  siteSlug: string;
  stack: string;
  apiBaseUrl: string;
}

async function fetchJson(url: string, key: string) {
  const res = await fetch(url, { headers: { "X-API-Key": key } });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`${url} → ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function generate(opts: GenerateOptions): Promise<void> {
  const readKey = process.env.GENERATOR_READ_KEY ?? "";
  if (!readKey) {
    throw new Error(
      "GENERATOR_READ_KEY is required in .env (the site's read API key)"
    );
  }

  console.log(`[generator] fetching data for site "${opts.siteSlug}"...`);

  // Fetch the new pages
  const pagesRes = await fetchJson(
    `${opts.apiBaseUrl}/api/v1/sites/${opts.siteSlug}/pages`,
    readKey
  );
  const pages = pagesRes?.pages ?? [];

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

  // Write .env.local
  const envLocal = [
    `CMS_API_URL=${opts.apiBaseUrl}`,
    `CMS_SITE_SLUG=${opts.siteSlug}`,
    `CMS_READ_KEY=${readKey}`,
    `NEXT_PUBLIC_SITE_NAME=${opts.siteSlug}`,
  ].join("\n");
  await fs.writeFile(path.join(outDir, ".env.local"), envLocal);

  // Write a bundle.json so the site has the data statically if needed
  await fs.writeFile(
    path.join(outDir, "cms-bundle.json"),
    JSON.stringify({ pages }, null, 2)
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