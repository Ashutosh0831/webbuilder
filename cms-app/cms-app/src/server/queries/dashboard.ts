import { requireSuperAdmin } from "@/server/authz";
import { prisma } from "@/server/db/prisma";

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