import type { FastifyRequest, FastifyReply } from "fastify";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, apiKeys } from "@cms/db";
import { verifyAccessToken } from "../lib/jwt.js";
import { hashApiKey } from "../lib/crypto.js";
import { Errors } from "../lib/errors.js";

const PEPPER = process.env.API_KEY_PEPPER!;

export async function requireJwt(
  req: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw Errors.unauthorized("Missing Bearer token");
  }
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
  } catch {
    throw Errors.unauthorized("Invalid or expired token");
  }
}

export async function requireSuperAdmin(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireJwt(req, reply);
  if (req.user?.role !== "super_admin") {
    throw Errors.forbidden("Super admin access required");
  }
}

export function requireApiKey(expectedType: "read" | "write" | "preview") {
  return async function (
    req: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    const header = req.headers["x-api-key"];
    const key = Array.isArray(header) ? header[0] : header;
    if (!key) throw Errors.unauthorized("Missing X-API-Key header");

    const keyHash = hashApiKey(key, PEPPER);

    const [row] = await db
      .select({ siteId: apiKeys.siteId, type: apiKeys.type })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          eq(apiKeys.type, expectedType),
          isNull(apiKeys.revokedAt)
        )
      )
      .limit(1);

    if (!row) throw Errors.unauthorized("Invalid API key");

    req.siteScope = {
      siteId: row.siteId,
      via: "api_key",
      keyType: row.type,
    };

    await db
      .update(apiKeys)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(apiKeys.keyHash, keyHash));
  };
}

export async function requireSiteAccess(
  req: FastifyRequest,
  siteId: string
): Promise<void> {
  if (req.user?.role === "super_admin") return;
  if (req.siteScope?.siteId === siteId) return;
  throw Errors.forbidden("No access to this site");
}