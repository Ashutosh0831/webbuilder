import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/server/db/prisma";

export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}

/** Get session, redirect if not logged in (called in Server Component) */
export async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new ForbiddenError("Authentication required");
  return session.user;
}

/** Check whether the user has a website-level permission (critical: prevent IDOR) */
export async function requireWebsitePermission(
  userId: string,
  websiteId: string,
  permission: { resource: string; action: string },
  globalRole: string
) {
  // super_admin bypasses membership check
  if (globalRole === "super_admin") return;

  // Must query via composite primary key, not fetch website then check userId
  const membership = await prisma.websiteMember.findUnique({
    where: { websiteId_userId: { websiteId, userId } },
    include: {
      role: {
        include: {
          permissions: { include: { permission: { select: { code: true } } } },
        },
      },
    },
  });

  if (!membership) throw new NotFoundError(); // Return 404, not 403, to prevent enumeration

  if (permission.action === "read") return;

  const permissionCode =
    permission.resource === "website" && permission.action === "update"
      ? "website:manage"
      : permission.resource === "page" && permission.action === "create"
        ? "page:create"
        : permission.resource === "page" && permission.action === "update"
          ? "page:edit"
          : permission.resource === "page" && permission.action === "delete"
            ? "page:delete"
            : permission.resource === "publish" && permission.action === "submit"
              ? "publish:submit"
              : permission.resource === "publish" && permission.action === "approve"
                ? "publish:approve"
                : permission.resource === "domain" && permission.action === "manage"
                  ? "domain:manage"
                : null;

  const hasPermission = permissionCode !== null &&
    membership.role.permissions.some(({ permission: rolePermission }) =>
      rolePermission.code === permissionCode
    );
  if (!hasPermission) throw new ForbiddenError("Insufficient permissions");
}

export async function requireSuperAdmin() {
  const user = await requireAuth();
  if (user.role !== "super_admin") {
    throw new ForbiddenError("Super admin access required");
  }
  return user;
}