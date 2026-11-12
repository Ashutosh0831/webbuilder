import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "super_admin") redirect("/dashboard");
  return user;
}

export async function requireWebsitePermission(
  userId: string,
  websiteId: string,
  permission: { resource: string; action: string },
  globalRole: string,
) {
  if (globalRole === "super_admin") return;

  const membership = await prisma.websiteMember.findUnique({
    where: { websiteId_userId: { websiteId, userId } },
    include: { role: true },
  });

  if (!membership) throw new Error("NOT_FOUND");

  const result = await auth.api.userHasPermission({
    body: {
      userId,
      role: membership.role.name as "editor" | "super_admin" | "website_owner",
      permissions: {
        [permission.resource]: [permission.action],
      } as Record<string, string[]>,
    },
  });

  if (!result.success) throw new Error("FORBIDDEN");
}
