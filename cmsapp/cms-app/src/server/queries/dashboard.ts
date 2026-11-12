import { requireSuperAdmin } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";

export async function getWorkspaceDashboard(userId: string, role: string) {
  const websiteScope: Prisma.WebsiteWhereInput = {
    deletedAt: null,
    ...(role === "super_admin" ? {} : { members: { some: { userId } } }),
  };

  const [websites, pages, media, teamMembers, activity] = await Promise.all([
    prisma.website.count({ where: websiteScope }),
    prisma.page.count({ where: { deletedAt: null, website: websiteScope } }),
    prisma.media.count({ where: { deletedAt: null, website: websiteScope } }),
    prisma.user.count({
      where: {
        deletedAt: null,
        websiteMembers: { some: { website: websiteScope } },
      },
    }),
    prisma.auditLog.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, resource: true, createdAt: true },
    }),
  ]);

  return { websites, pages, media, teamMembers, activity };
}

export async function getDashboardMetrics() {
  await requireSuperAdmin();

  const [
    totalWebsites,
    activeWebsites,
    totalCustomers,
    totalUsers,
    pendingPublishRequests,
  ] = await Promise.all([
    prisma.website.count({ where: { deletedAt: null } }),
    prisma.website.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.publicationRequest.count({ where: { status: "PENDING" } }),
  ]);

  return {
    totalWebsites,
    activeWebsites,
    totalCustomers,
    totalUsers,
    pendingPublishRequests,
  };
}

export async function getRecentWebsites() {
  await requireSuperAdmin();

  return prisma.website.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      customer: { select: { name: true } },
      _count: { select: { pages: true } },
    },
  });
}

export async function getRecentActivity() {
  await requireSuperAdmin();

  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { actor: { select: { name: true } } },
  });
}