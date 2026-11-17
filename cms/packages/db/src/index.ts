import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Make sure .env exists at the repo root and is being loaded."
  );
}

const queryClient = postgres(connectionString, { max: 10 });

export const db = drizzle(queryClient, { schema });
export * from "./schema/index.js";
