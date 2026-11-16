import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { sql } from "drizzle-orm";
import { db } from "@cms/db";
import { authRoutes } from "./routes/auth.js";
import { clientRoutes } from "./routes/clients.js";
import { siteRoutes } from "./routes/sites.js";
import { contentTypeRoutes } from "./routes/contentTypes.js";
import { contentEntryRoutes } from "./routes/contentEntries.js";
import { siteSettingsRoutes } from "./routes/siteSettings.js";
import { mediaRoutes } from "./routes/media.js";
import { relationRoutes } from "./routes/relations.js";
import { menuRoutes } from "./routes/menu.js";
import { formRoutes } from "./routes/forms.js";
import { ensureBucket } from "./lib/storage.js";
import { ApiError } from "./lib/errors.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ApiError) {
    return reply.status(err.statusCode).send({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  if (err.validation) {
    return reply.status(400).send({
      error: { code: "VALIDATION", message: err.message },
    });
  }
  app.log.error(err);
  return reply.status(500).send({
    error: { code: "INTERNAL", message: "Internal server error" },
  });
});

app.get("/health", async () => {
  let dbStatus: "ok" | "error" = "ok";
  let dbError: string | undefined;
  try {
    await db.execute(sql`select 1`);
  } catch (err) {
    dbStatus = "error";
    dbError = err instanceof Error ? err.message : String(err);
  }
  return {
    api: "ok",
    db: dbStatus,
    dbError,
    timestamp: new Date().toISOString(),
  };
});

await app.register(authRoutes);
await app.register(clientRoutes);
await app.register(siteRoutes);
await app.register(contentTypeRoutes);
await app.register(contentEntryRoutes);
await app.register(siteSettingsRoutes);
await app.register(mediaRoutes);
await app.register(relationRoutes);
await app.register(menuRoutes);
await app.register(formRoutes);

// Ensure media bucket exists at startup
try {
  await ensureBucket();
  app.log.info("S3 bucket ready");
} catch (err) {
  app.log.warn(
    { err },
    "Could not ensure S3 bucket — media upload may fail"
  );
}

const port = Number(process.env.API_PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });