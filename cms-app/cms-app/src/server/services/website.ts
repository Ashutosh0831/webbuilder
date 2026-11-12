import { requireSuperAdmin, requireWebsitePermission, requireAuth } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import type { createWebsiteSchema, updateWebsiteSchema, websiteFilterSchema } from "@/lib/validations/website";

export async function createWebsite(data: z.infer<typeof createWebsiteSchema>) {
  const admin = await requireSuperAdmin();

  // Enforce customer website quota
  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, deletedAt: null },
    include: { _count: { select: { websites: true } } },
  });
  if (!customer) throw new Error("Customer not found");
  if (customer._count.websites >= customer.websiteQuota) {
    throw new Error("Website quota exceeded for this customer");
  }

  const website = await prisma.website.create({
    data: {
      customerId: data.customerId,
      name: data.name,
      slug: data.slug,
      description: data.description,
      locale: data.locale,
      timezone: data.timezone,
      status: "DRAFT",
      settings: { create: {} }, // default settings row
    },
  });

  // Audit log assignment
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "website.create",
      resource: `Website:${website.id}`,
      metadata: { customerId: data.customerId, name: data.name },
    },
  });

  return website;
}

export async function getWebsites(filter: z.infer<typeof websiteFilterSchema>, userId: string, role: string) {
  await requireAuth();

  const where: Prisma.WebsiteWhereInput = {
    deletedAt: null,
    ...(filter.status && { status: filter.status }),
    ...(filter.customerId && { customerId: filter.customerId }),
    ...(filter.search && {
      OR: [
        { name: { contains: filter.search, mode: "insensitive" as const } },
        { slug: { contains: filter.search, mode: "insensitive" as const } },
      ],
    }),
  };

  // Non-super-admins see only their assigned websites
  if (role !== "super_admin") {
    where["members"] = { some: { userId } };
  }

  const [websites, total] = await Promise.all([
    prisma.website.findMany({
      where,
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        _count: { select: { members: true, pages: true } },
      },
    }),
    prisma.website.count({ where }),
  ]);

  return { websites, total, totalPages: Math.ceil(total / filter.pageSize) };
}

export async function getWebsiteById(id: string, userId: string, role: string) {
  await requireAuth();

  const website = await prisma.website.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, name: true, contactEmail: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          role: true,
        },
      },
      domains: true,
      _count: { select: { pages: true, media: true } },
    },
  });

  if (!website) return null;

  // Non-super-admins must be members
  if (role !== "super_admin") {
    const isMember = website.members.some((m) => m.user.id === userId);
    if (!isMember) return null; // return null, not throw, to avoid 403 enumeration
  }

  return website;
}

export async function updateWebsite(data: z.infer<typeof updateWebsiteSchema>, userId: string, role: string) {
  await requireWebsitePermission(userId, data.id, { resource: "website", action: "update" }, role);

  return prisma.website.update({
    where: { id: data.id, deletedAt: null },
    data: {
      name: data.name,
      description: data.description,
      locale: data.locale,
      timezone: data.timezone,
    },
  });
}

export async function setWebsiteStatus(id: string, status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED") {
  const admin = await requireSuperAdmin();

  const website = await prisma.website.update({
    where: { id, deletedAt: null },
    data: { status },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: `website.status.${status.toLowerCase()}`,
      resource: `Website:${id}`,
      metadata: { newStatus: status },
    },
  });

  return website;
}

export async function archiveWebsite(id: string) {
  const admin = await requireSuperAdmin();

  // Soft delete + status ARCHIVED. Pages/publications preserved.
  const website = await prisma.website.update({
    where: { id, deletedAt: null },
    data: { status: "ARCHIVED", deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "website.archive",
      resource: `Website:${id}`,
    },
  });

  return website;
}

export async function assignEditor(websiteId: string, userId: string, roleId: string) {
  const admin = await requireSuperAdmin();

  // Verify user belongs to same customer as website
  const website = await prisma.website.findFirst({
    where: { id: websiteId, deletedAt: null },
    select: { customerId: true },
  });
  if (!website) throw new Error("Website not found");

  const user = await prisma.user.findFirst({
    where: { id: userId, customerId: website.customerId, deletedAt: null },
  });
  if (!user) throw new Error("User does not belong to this customer");

  const member = await prisma.websiteMember.create({
    data: { websiteId, userId, roleId },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "website.member.assign",
      resource: `Website:${websiteId}`,
      metadata: { userId, roleId },
    },
  });

  return member;
}

export async function removeEditor(websiteId: string, userId: string) {
  const admin = await requireSuperAdmin();

  await prisma.websiteMember.delete({
    where: { websiteId_userId: { websiteId, userId } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "website.member.remove",
      resource: `Website:${websiteId}`,
      metadata: { userId },
    },
  });
}

export async function reassignCustomer(websiteId: string, newCustomerId: string) {
  const admin = await requireSuperAdmin();

  const website = await prisma.website.update({
    where: { id: websiteId, deletedAt: null },
    data: { customerId: newCustomerId },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "website.customer.reassign",
      resource: `Website:${websiteId}`,
      metadata: { newCustomerId },
    },
  });

  return website;
}