#!/usr/bin/env tsx
import "dotenv/config";
import { parseArgs } from "node:util";
import { generate } from "./generate.js";

const { values } = parseArgs({
  options: {
    site: { type: "string", short: "s" },
    stack: { type: "string", default: "nextjs" },
    "api-url": {
      type: "string",
      default: process.env.API_BASE_URL ?? "http://localhost:4000",
    },
  },
});

if (!values.site) {
  console.error("Usage: pnpm generate --site=<siteSlug> [--stack=nextjs]");
  process.exit(1);
}

await generate({
  siteSlug: values.site,
  stack: values.stack ?? "nextjs",
  apiBaseUrl: values["api-url"]!,
});