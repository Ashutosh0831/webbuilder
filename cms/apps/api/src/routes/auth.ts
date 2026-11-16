import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, users } from "@cms/db";
import { hashPassword, verifyPassword } from "../lib/crypto.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { requireJwt } from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  bootstrapToken: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/admin/auth/register", async (req) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest("Invalid body", parsed.error.flatten());
    }
    const { name, email, password, bootstrapToken } = parsed.data;

    if (bootstrapToken !== process.env.BOOTSTRAP_TOKEN) {
      throw Errors.forbidden("Invalid bootstrap token");
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      throw Errors.conflict("Email already registered");
    }

    const passwordHash = await hashPassword(password);

    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
        platformRole: "super_admin",
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        platformRole: users.platformRole,
      });

    return { user: created };
  });

  app.post("/api/admin/auth/login", async (req) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.badRequest("Invalid body", parsed.error.flatten());
    }
    const { email, password } = parsed.data;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) throw Errors.unauthorized("Invalid credentials");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw Errors.unauthorized("Invalid credentials");

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.platformRole,
    });
    const refreshToken = signRefreshToken({ sub: user.id });

    return { accessToken, refreshToken };
  });

  app.post("/api/admin/auth/refresh", async (req) => {
    const body = req.body as { refreshToken?: string };
    if (!body?.refreshToken) throw Errors.badRequest("refreshToken required");
    try {
      const payload = verifyRefreshToken(body.refreshToken);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);
      if (!user) throw Errors.unauthorized("User not found");
      const accessToken = signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.platformRole,
      });
      return { accessToken };
    } catch {
      throw Errors.unauthorized("Invalid refresh token");
    }
  });

  app.get("/api/admin/me", { preHandler: requireJwt }, async (req) => {
    return { user: req.user };
  });
}