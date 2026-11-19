import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { sql } from "drizzle-orm";
import { db } from "@cms/db";
import { authRoutes } from "./routes/auth.js";
import { clientRoutes } from "./routes/clients.js";
import { siteRoutes } from "./routes/sites.js";
import { userRoutes } from "./routes/users.js";
import { deploymentRoutes } from "./routes/deployments.js";
import { contentTypeRoutes } from "./routes/contentTypes.js";
import { contentEntryRoutes } from "./routes/contentEntries.js";
import { siteSettingsRoutes } from "./routes/siteSettings.js";
import { mediaRoutes } from "./routes/media.js";
import { relationRoutes } from "./routes/relations.js";
import { menuRoutes } from "./routes/menu.js";
import { formRoutes } from "./routes/forms.js";
import { ensureBucket } from "./lib/storage.js";
import { ApiError } from "./lib/errors.js";
import { pageRoutes } from "./routes/pages.js";
import { startOutboxWorker } from "./lib/worker.js";
import { recoverLocalDeployments } from "./lib/deploymentRunner.js";
import { rateLimitStoreHealth } from "./lib/rateLimit.js";

function getAllowedOrigins(): string[] {
  const raw =
    process.env.CORS_ALLOWED_ORIGINS ??
    "http://localhost:5173,http://localhost:3000";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export async function buildServer() {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  const allowedOrigins = new Set(getAllowedOrigins());

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error("Origin not allowed by CORS"), false);
    },
    credentials: true,
  });

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
    let rateLimitStore: Awaited<ReturnType<typeof rateLimitStoreHealth>> = { status: "ok" };
    try {
      await db.execute(sql`select 1`);
    } catch (err) {
      dbStatus = "error";
      dbError = err instanceof Error ? err.message : String(err);
    }
    rateLimitStore = await rateLimitStoreHealth();
    return {
      api: "ok",
      db: dbStatus,
      dbError,
      rateLimitStore: rateLimitStore.status,
      rateLimitStoreError: rateLimitStore.message,
      timestamp: new Date().toISOString(),
    };
  });

  await app.register(authRoutes);
  await app.register(clientRoutes);
  await app.register(siteRoutes);
  await app.register(userRoutes);
  await app.register(deploymentRoutes);
  await app.register(pageRoutes);
  await app.register(contentTypeRoutes);
  await app.register(contentEntryRoutes);
  await app.register(siteSettingsRoutes);
  await app.register(mediaRoutes);
  await app.register(relationRoutes);
  await app.register(menuRoutes);
  await app.register(formRoutes);

  return app;
}

const entryPath = process.argv[1];
const isDirectExecution = entryPath !== undefined &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(entryPath);

if (isDirectExecution) {
  const app = await buildServer();

  try {
    await ensureBucket();
    app.log.info("S3 bucket ready");
  } catch (err) {
    app.log.warn(
      { err },
      "Could not ensure S3 bucket — media upload may fail"
    );
  }

  startOutboxWorker(5000);
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
  void recoverLocalDeployments().catch((error) => {
    app.log.error({ err: error }, "Could not restore local website processes");
  });
}
