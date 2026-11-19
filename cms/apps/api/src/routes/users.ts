import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  users,
  sites,
  auditLog,
  clients,
  userSiteAccess,
  userClientAccess,
} from "@cms/db";
import { SITE_ROLES, SITE_ROLE_RANK, type SiteRole } from "@cms/shared";
import { hashPassword } from "../lib/crypto.js";
import {
  requireSiteRole,
  requireSuperAdmin,
  resolveUserSiteRole,
} from "../middleware/auth.js";
import { Errors } from "../lib/errors.js";

const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  platformRole: z.enum(["super_admin"]).nullable().optional(),
});

const assignSiteMemberSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  siteRole: z.enum(SITE_ROLES),
}).refine((value) => Boolean(value.userId || value.email), { message: "A userId or email is required" });

const assignClientOwnerSchema = z.object({
  userId: z.string().uuid(),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // List all users (super admin only)
  app.get(
    "/api/admin/users",
    { preHandler: requireSuperAdmin },
    async () => {
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          platformRole: users.platformRole,
          createdAt: users.createdAt,
        })
        .from(users);
      return { users: rows };
    }
  );

  // Create a user (super admin only)
  app.post(
    "/api/admin/users",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }

      const email = parsed.data.email.trim().toLowerCase();
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (existing.length > 0) {
        throw Errors.conflict("Email already registered");
      }

      const passwordHash = await hashPassword(parsed.data.password);
      const [created] = await db
        .insert(users)
        .values({
          name: parsed.data.name.trim(),
          email,
          passwordHash,
          platformRole: parsed.data.platformRole ?? null,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          platformRole: users.platformRole,
          createdAt: users.createdAt,
        });

      return { user: created };
    }
  );

  // List members with access to a site (requires client_admin+)
  app.get(
    "/api/admin/sites/:siteId/members",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const rows = await db
        .select({
          id: userSiteAccess.id,
          userId: users.id,
          name: users.name,
          email: users.email,
          siteRole: userSiteAccess.siteRole,
          createdAt: userSiteAccess.createdAt,
        })
        .from(userSiteAccess)
        .innerJoin(users, eq(users.id, userSiteAccess.userId))
        .where(eq(userSiteAccess.siteId, siteId));

      return { members: rows };
    }
  );

  // Assign or update a user's role on a site (requires client_admin+, cannot grant above own role)
  app.post(
    "/api/admin/sites/:siteId/members",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId } = req.params as { siteId: string };
      const parsed = assignSiteMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }

      const callerRole = req.siteScope!.siteRole as SiteRole;
      if (req.user?.role !== "super_admin" && SITE_ROLE_RANK[parsed.data.siteRole] > SITE_ROLE_RANK[callerRole]) {
        throw Errors.forbidden("Cannot assign a role higher than your own");
      }
      const member = await db.transaction(async (tx) => {
        const [site] = await tx.select({ id: sites.id }).from(sites).where(eq(sites.id, siteId)).limit(1).for("update");
        if (!site) throw Errors.notFound("Site not found");
        const [targetUser] = parsed.data.userId
          ? await tx.select({ id: users.id, platformRole: users.platformRole }).from(users).where(eq(users.id, parsed.data.userId)).limit(1)
          : await tx.select({ id: users.id, platformRole: users.platformRole }).from(users).where(eq(users.email, parsed.data.email!.trim().toLowerCase())).limit(1);
        if (!targetUser) throw Errors.notFound("User not found");
        const currentTargetRole = await resolveUserSiteRole(targetUser.id, targetUser.platformRole, siteId);
        if (req.user?.role !== "super_admin" && currentTargetRole && SITE_ROLE_RANK[currentTargetRole] > SITE_ROLE_RANK[callerRole]) {
          throw Errors.forbidden("You cannot change a member whose current role is higher than your own");
        }
        const [existingMember] = await tx.select({ siteRole: userSiteAccess.siteRole })
          .from(userSiteAccess).where(and(eq(userSiteAccess.userId, targetUser.id), eq(userSiteAccess.siteId, siteId))).limit(1);
        const [updated] = await tx
          .insert(userSiteAccess)
          .values({ userId: targetUser.id, siteId, siteRole: parsed.data.siteRole })
          .onConflictDoUpdate({
            target: [userSiteAccess.userId, userSiteAccess.siteId],
            set: { siteRole: parsed.data.siteRole },
          })
          .returning();
        await tx.insert(auditLog).values({
          siteId,
          userId: req.user!.sub,
          action: existingMember ? "site.member.role.updated" : "site.member.added",
          entityType: "user",
          entityId: targetUser.id,
          before: existingMember ? { siteRole: existingMember.siteRole } : null,
          after: { siteRole: updated.siteRole },
          ip: req.ip,
        });
        return updated;
      });

      return { member };
    }
  );

  // Remove a user's access to a site
  app.delete(
    "/api/admin/sites/:siteId/members/:userId",
    { preHandler: requireSiteRole("client_admin") },
    async (req) => {
      const { siteId, userId } = req.params as { siteId: string; userId: string };
      const callerRole = req.siteScope!.siteRole as SiteRole;
      await db.transaction(async (tx) => {
        const [site] = await tx.select({ clientId: sites.clientId }).from(sites).where(eq(sites.id, siteId)).limit(1).for("update");
        if (!site) throw Errors.notFound("Site not found");
        const [member] = await tx.select({ id: userSiteAccess.id, siteRole: userSiteAccess.siteRole })
          .from(userSiteAccess).where(and(eq(userSiteAccess.siteId, siteId), eq(userSiteAccess.userId, userId))).limit(1);
        if (!member) throw Errors.notFound("Member not found");
        const [targetUser] = await tx.select({ platformRole: users.platformRole }).from(users).where(eq(users.id, userId)).limit(1);
        if (!targetUser) throw Errors.notFound("User not found");
        const targetRole = await resolveUserSiteRole(userId, targetUser.platformRole, siteId);
        if (req.user?.role !== "super_admin" && targetRole && SITE_ROLE_RANK[targetRole] > SITE_ROLE_RANK[callerRole]) {
          throw Errors.forbidden("You cannot remove a member whose effective role is higher than your own");
        }
        const [clientGrant] = await tx.select({ userId: userClientAccess.userId }).from(userClientAccess)
          .where(and(eq(userClientAccess.clientId, site.clientId), eq(userClientAccess.userId, userId))).limit(1);
        if (clientGrant) throw Errors.conflict("This user also has client-level access; removing the site assignment would not revoke their website access");

        if (member.siteRole === "client_owner") {
          const siteOwners = await tx.select({ userId: userSiteAccess.userId }).from(userSiteAccess)
            .where(and(eq(userSiteAccess.siteId, siteId), eq(userSiteAccess.siteRole, "client_owner")));
          const clientOwners = await tx.select({ userId: userClientAccess.userId }).from(userClientAccess)
            .where(and(eq(userClientAccess.clientId, site.clientId), eq(userClientAccess.role, "client_owner")));
          const ownerIds = new Set([...siteOwners, ...clientOwners].map((owner) => owner.userId));
          if (ownerIds.size <= 1 && ownerIds.has(userId)) throw Errors.conflict("The last site owner cannot be removed");
        }

        const [deleted] = await tx.delete(userSiteAccess)
          .where(and(eq(userSiteAccess.siteId, siteId), eq(userSiteAccess.userId, userId)))
          .returning({ id: userSiteAccess.id });
        if (!deleted) throw Errors.notFound("Member not found");
        await tx.insert(auditLog).values({
          siteId,
          userId: req.user!.sub,
          action: "site.member.removed",
          entityType: "user",
          entityId: userId,
          before: { siteRole: member.siteRole },
          ip: req.ip,
        });
      });
      return { deleted: true };
    }
  );

  // Assign client owner (super admin only)
  app.post(
    "/api/admin/clients/:clientId/owners",
    { preHandler: requireSuperAdmin },
    async (req) => {
      const { clientId } = req.params as { clientId: string };
      const parsed = assignClientOwnerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw Errors.badRequest("Invalid body", parsed.error.flatten());
      }

      const [client] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      if (!client) throw Errors.notFound("Client not found");

      const [access] = await db
        .insert(userClientAccess)
        .values({
          userId: parsed.data.userId,
          clientId,
          role: "client_owner",
        })
        .onConflictDoUpdate({
          target: [userClientAccess.userId, userClientAccess.clientId],
          set: { role: "client_owner" },
        })
        .returning();

      return { owner: access };
    }
  );
}
