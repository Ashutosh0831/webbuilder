import type { FastifyRequest, FastifyReply } from "fastify";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  apiKeys,
  sites,
  userSiteAccess,
  userClientAccess,
} from "@cms/db";
import { hasMinSiteRole, SITE_ROLE_RANK, type SiteRole } from "@cms/shared";
import { verifyAccessToken } from "../lib/jwt.js";
import { hashApiKey } from "../lib/crypto.js";
import { Errors } from "../lib/errors.js";

const PEPPER = process.env.API_KEY_PEPPER!;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * Resolves the effective SiteRole for a user on a given siteId.
 * Checks direct userSiteAccess as well as client-level ownership (userClientAccess).
 */
export async function resolveUserSiteRole(
  userId: string,
  platformRole: "super_admin" | null,
  siteId: string
): Promise<SiteRole | null> {
  if (platformRole === "super_admin") {
    return "client_owner";
  }
  if (!UUID_RE.test(siteId)) {
    return null;
  }

  const [siteRow] = await db
    .select({ id: sites.id, clientId: sites.clientId })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!siteRow) return null;

  const [direct] = await db
    .select({ siteRole: userSiteAccess.siteRole })
    .from(userSiteAccess)
    .where(
      and(eq(userSiteAccess.userId, userId), eq(userSiteAccess.siteId, siteId))
    )
    .limit(1);

  const [clientAccess] = await db
    .select({ role: userClientAccess.role })
    .from(userClientAccess)
    .where(
      and(
        eq(userClientAccess.userId, userId),
        eq(userClientAccess.clientId, siteRow.clientId)
      )
    )
    .limit(1);

  const directRole = direct?.siteRole ?? null;
  const ownerRole: SiteRole | null =
    clientAccess?.role === "client_owner" ? "client_owner" : null;

  if (!directRole) return ownerRole;
  if (!ownerRole) return directRole;
  return SITE_ROLE_RANK[ownerRole] >= SITE_ROLE_RANK[directRole]
    ? ownerRole
    : directRole;
}

/**
 * Middleware factory enforcing that the authenticated user has at least `minRole`
 * for the site identified by `req.params[siteIdParam]`.
 */
export function requireSiteRole(minRole: SiteRole, siteIdParam = "siteId") {
  return async function (
    req: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    await requireJwt(req, reply);
    const params = req.params as Record<string, string | undefined>;
    const siteId = params?.[siteIdParam];
    if (!siteId || !UUID_RE.test(siteId)) {
      throw Errors.badRequest("Valid siteId is required");
    }

    const effectiveRole = await resolveUserSiteRole(
      req.user!.sub,
      req.user!.role,
      siteId
    );

    if (!hasMinSiteRole(effectiveRole, minRole)) {
      throw Errors.forbidden("You do not have permission for this site");
    }

    req.siteScope = {
      siteId,
      via: "jwt",
      siteRole: effectiveRole!,
    };
  };
}

/**
 * Helper for routes where siteId is looked up from a child resource (e.g., mediaId, menuId).
 */
export async function assertUserSiteRole(
  req: FastifyRequest,
  siteId: string,
  minRole: SiteRole
): Promise<SiteRole> {
  if (!req.user) {
    throw Errors.unauthorized("Authentication required");
  }
  const effectiveRole = await resolveUserSiteRole(
    req.user.sub,
    req.user.role,
    siteId
  );
  if (!hasMinSiteRole(effectiveRole, minRole)) {
    throw Errors.forbidden("You do not have permission for this site");
  }
  req.siteScope = {
    siteId,
    via: "jwt",
    siteRole: effectiveRole!,
  };
  return effectiveRole!;
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
      .select({
        siteId: apiKeys.siteId,
        type: apiKeys.type,
        siteStatus: sites.status,
      })
      .from(apiKeys)
      .innerJoin(sites, eq(sites.id, apiKeys.siteId))
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          eq(apiKeys.type, expectedType),
          isNull(apiKeys.revokedAt)
        )
      )
      .limit(1);

    if (!row) throw Errors.unauthorized("Invalid API key");
    if (row.siteStatus !== "active") {
      throw Errors.forbidden("Site is not active");
    }

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
  siteId: string,
  minRole: SiteRole = "viewer"
): Promise<void> {
  if (req.siteScope?.via === "api_key") {
    if (req.siteScope.siteId === siteId) return;
    throw Errors.forbidden("API key not valid for this site");
  }
  await assertUserSiteRole(req, siteId, minRole);
}