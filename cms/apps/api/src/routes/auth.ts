import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import {
  db,
  users,
  refreshTokens,
  passwordResetTokens,
  userSiteAccess,
  userClientAccess,
} from "@cms/db";
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  timingSafeEqualStr,
  verifyPassword,
} from "../lib/crypto.js";
import {
  getRefreshTtlMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { enforceRateLimit } from "../lib/rateLimit.js";
import { clearRefreshCookie, isAllowedCookieOrigin, readCookieHeader, REFRESH_COOKIE_NAME, serializeRefreshCookie } from "../lib/authCookies.js";
import { requireJwt } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

const registerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  bootstrapToken: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1),
  useCookies: z.boolean().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

function assertCookieRequestOrigin(req: import("fastify").FastifyRequest): void {
  const configured = process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:5173,http://localhost:3000";
  const allowed = configured.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!isAllowedCookieOrigin(req.headers.origin, allowed)) {
    throw Errors.forbidden("Cookie authentication request origin is not allowed");
  }
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Secure initial super_admin registration: only allowed when zero super_admins exist
  app.post("/api/admin/auth/register", async (req) => {
    await enforceRateLimit({
      key: `register:${req.ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest("Invalid body", parsed.error.flatten());
    }
    const { name, email, password, bootstrapToken } = parsed.data;
    const expectedBootstrap = process.env.BOOTSTRAP_TOKEN ?? "";

    if (!expectedBootstrap || !timingSafeEqualStr(bootstrapToken, expectedBootstrap)) {
      throw Errors.forbidden("Invalid bootstrap token");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);

    const created = await db.transaction(async (tx) => {
      const superAdmins = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.platformRole, "super_admin"))
        .limit(1);

      if (superAdmins.length > 0) {
        throw Errors.forbidden("Initial super admin has already been registered");
      }

      const existing = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existing.length > 0) {
        throw Errors.conflict("Email already registered");
      }

      const [user] = await tx
        .insert(users)
        .values({
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          platformRole: "super_admin",
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          platformRole: users.platformRole,
        });

      return user;
    });

    return { user: created };
  });

  app.post("/api/admin/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest("Invalid body", parsed.error.flatten());
    }
    if (parsed.data.useCookies) assertCookieRequestOrigin(req);
    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    await enforceRateLimit(
      {
        key: `login:${req.ip}:${normalizedEmail}`,
        limit: 10,
        windowMs: 15 * 60 * 1000,
      },
      "Too many login attempts. Please try again in 15 minutes."
    );

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) throw Errors.unauthorized("Invalid credentials");

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) throw Errors.unauthorized("Invalid credentials");

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.platformRole,
    });

    const familyId = crypto.randomUUID();
    const refreshToken = signRefreshToken({ sub: user.id, fam: familyId });
    const tokenHash = hashToken(refreshToken);

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt: new Date(Date.now() + getRefreshTtlMs()),
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? null,
    });

    if (parsed.data.useCookies) {
      reply.header("Set-Cookie", serializeRefreshCookie(refreshToken, getRefreshTtlMs()));
      return { accessToken };
    }
    return { accessToken, refreshToken };
  });

  // Refresh token rotation with reuse detection
  app.post("/api/admin/auth/refresh", async (req, reply) => {
    const body = req.body as { refreshToken?: string } | undefined;
    const cookieToken = readCookieHeader(req.headers.cookie, REFRESH_COOKIE_NAME);
    const useCookie = Boolean(cookieToken);
    if (useCookie) assertCookieRequestOrigin(req);
    const parsed = refreshSchema.safeParse({ refreshToken: cookieToken ?? body?.refreshToken });
    if (!parsed.success) {
      if (useCookie) reply.header("Set-Cookie", clearRefreshCookie());
      throw Errors.badRequest("refreshToken required");
    }

    let payload;
    try {
      payload = verifyRefreshToken(parsed.data.refreshToken);
    } catch {
      if (useCookie) reply.header("Set-Cookie", clearRefreshCookie());
      throw Errors.unauthorized("Invalid refresh token");
    }

    const presentedHash = hashToken(parsed.data.refreshToken);

    const result = await db.transaction(async (tx) => {
      const [stored] = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, presentedHash))
        .limit(1);

      if (!stored) return { failure: "Invalid refresh token" as const };

      // Reuse detection: if token was already revoked, revoke the entire token family
      if (stored.revokedAt) {
        await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(refreshTokens.familyId, stored.familyId),
              isNull(refreshTokens.revokedAt)
            )
          );
        // Return after the update so this transaction commits the family revoke.
        return { failure: "Refresh token reuse detected" as const };
      }

      if (stored.expiresAt <= new Date()) {
        return { failure: "Refresh token expired" as const };
      }

      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);
      if (!user) return { failure: "User not found" as const };

      const newAccessToken = signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.platformRole,
      });

      const newRefreshToken = signRefreshToken({
        sub: user.id,
        fam: stored.familyId,
      });
      const newHash = hashToken(newRefreshToken);

      const [inserted] = await tx
        .insert(refreshTokens)
        .values({
          userId: user.id,
          tokenHash: newHash,
          familyId: stored.familyId,
          expiresAt: new Date(Date.now() + getRefreshTtlMs()),
          ip: req.ip,
          userAgent: req.headers["user-agent"] ?? null,
        })
        .returning({ id: refreshTokens.id });

      await tx
        .update(refreshTokens)
        .set({
          revokedAt: new Date(),
          replacedById: inserted.id,
        })
        .where(eq(refreshTokens.id, stored.id));

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    });
    if ("failure" in result) {
      if (useCookie) reply.header("Set-Cookie", clearRefreshCookie());
      throw Errors.unauthorized(result.failure);
    }
    if (useCookie) {
      reply.header("Set-Cookie", serializeRefreshCookie(result.refreshToken, getRefreshTtlMs()));
      return { accessToken: result.accessToken };
    }
    return result;
  });

  app.post("/api/admin/auth/logout", async (req, reply) => {
    const body = req.body as { refreshToken?: string } | undefined;
    const cookieToken = readCookieHeader(req.headers.cookie, REFRESH_COOKIE_NAME);
    if (cookieToken) assertCookieRequestOrigin(req);
    const refreshToken = cookieToken ?? body?.refreshToken;
    reply.header("Set-Cookie", clearRefreshCookie());
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      const [stored] = await db
        .select({ familyId: refreshTokens.familyId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);
      if (stored) {
        await db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(refreshTokens.familyId, stored.familyId),
              isNull(refreshTokens.revokedAt)
            )
          );
      }
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      try {
        await requireJwt(req, {} as any);
        if (req.user?.sub) {
          await db
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(refreshTokens.userId, req.user.sub),
                isNull(refreshTokens.revokedAt)
              )
            );
        }
      } catch {
        // Ignore invalid access tokens on logout
      }
    }
    return { ok: true };
  });

  app.post("/api/admin/auth/forgot-password", async (req) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest("Valid email is required");
    }
    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    await enforceRateLimit({
      key: `forgot:${req.ip}:${normalizedEmail}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (user) {
      const resetToken = generateOpaqueToken("rst_");
      const tokenHash = hashToken(resetToken);
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      });
      req.log.info(
        { userId: user.id },
        "Password reset token issued (deliver via configured mail transport)"
      );
    }

    // Always return ok to avoid user enumeration
    return { ok: true };
  });

  app.post("/api/admin/auth/reset-password", async (req) => {
    await enforceRateLimit({
      key: `reset:${req.ip}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });

    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest("Invalid reset payload", parsed.error.flatten());
    }

    const tokenHash = hashToken(parsed.data.token);
    const newPasswordHash = await hashPassword(parsed.data.newPassword);

    await db.transaction(async (tx) => {
      const [resetRow] = await tx
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, sql`now()`)
          )
        )
        .limit(1);

      if (!resetRow) {
        throw Errors.badRequest("Invalid or expired password reset token");
      }

      await tx
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(eq(users.id, resetRow.userId));

      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetRow.id));

      // Revoke all active refresh tokens on password reset
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.userId, resetRow.userId),
            isNull(refreshTokens.revokedAt)
          )
        );
    });

    return { ok: true };
  });

  app.get("/api/admin/me", { preHandler: requireJwt }, async (req) => {
    const [siteAccess, clientAccess] = await Promise.all([
      db
        .select({
          siteId: userSiteAccess.siteId,
          siteRole: userSiteAccess.siteRole,
        })
        .from(userSiteAccess)
        .where(eq(userSiteAccess.userId, req.user!.sub)),
      db
        .select({
          clientId: userClientAccess.clientId,
          role: userClientAccess.role,
        })
        .from(userClientAccess)
        .where(eq(userClientAccess.userId, req.user!.sub)),
    ]);

    return {
      user: req.user,
      siteAccess,
      clientAccess,
    };
  });
}
