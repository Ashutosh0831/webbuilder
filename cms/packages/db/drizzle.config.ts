import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL not found. Make sure packages/db/drizzle.config.ts can read the root .env file."
  );
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});