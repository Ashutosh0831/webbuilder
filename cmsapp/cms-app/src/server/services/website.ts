import { requireSuperAdmin, requireWebsitePermission, requireAuth } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import type { createWebsiteSchema, updateWebsiteSchema, websiteFilterSchema } from "@/lib/validations/website";
import { makeWebsiteRevisionSnapshot } from "@/server/services/versioning";

export async function createWebsite(data: z.infer<typeof createWebsiteSchema>) {
  const admin = await requireSuperAdmin();

  // Enforce customer website quota
  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, deletedAt: null, status: "ACTIVE" },
    include: { _count: { select: { websites: true } } },
  });
  if (!customer) throw new Error("Customer not found");
  if (customer._count.websites >= customer.websiteQuota) {
    throw new Error("Website quota exceeded for this customer");
  }

  const owner = await prisma.user.findFirst({
    where: {
      customerId: data.customerId,
      role: "website_owner",
      status: "ACTIVE",
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!owner) {
    throw new Error("This customer has no active Website Owner login. Open the customer record and create a customer login first.");
  }

  const ownerRole = await prisma.role.findUnique({
    where: { name: "WEBSITE_OWNER" },
    select: { id: true },
  });
  if (!ownerRole) {
    throw new Error("Website Owner permissions are not seeded. Run the database seed command, then try again.");
  }

  return prisma.$transaction(async (tx) => {
    const website = await tx.website.create({
      data: {
        customerId: data.customerId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        locale: data.locale,
        timezone: data.timezone,
        status: "DRAFT",
        version: 1,
        settings: { create: {} },
      },
      include: { settings: true },
    });

    await tx.websiteMember.create({
      data: {
        websiteId: website.id,
        userId: owner.id,
        roleId: ownerRole.id,
      },
    });

    await tx.contentVersion.create({
      data: {
        websiteId: website.id,
        resourceType: "WEBSITE",
        resourceId: website.id,
        version: 1,
        authorId: admin.id,
        snapshot: makeWebsiteRevisionSnapshot(website, website.settings) as Prisma.InputJsonValue,
        changeNote: "Initial website snapshot",
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: "website.create",
        resource: `Website:${website.id}`,
        metadata: { customerId: data.customerId, ownerUserId: owner.id, name: data.name },
      },
    });
    return website;
  });
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

  const current = await prisma.website.findFirst({
    where: { id: data.id, deletedAt: null },
    include: { settings: true },
  });
  if (!current) throw new Error("Website not found");
  if (data.expectedVersion !== undefined && data.expectedVersion !== current.version) {
    throw new Error("This website was updated elsewhere. Reload before saving again.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.website.updateMany({
      where: { id: data.id, version: current.version, deletedAt: null },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.locale !== undefined && { locale: data.locale }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new Error("This website was updated elsewhere. Reload before saving again.");

    const existingSnapshot = await tx.contentVersion.findFirst({
      where: { websiteId: data.id, resourceType: "WEBSITE", resourceId: data.id },
      select: { id: true },
    });
    if (!existingSnapshot) {
      await tx.contentVersion.create({
        data: {
          websiteId: data.id,
          resourceType: "WEBSITE",
          resourceId: data.id,
          version: current.version,
          authorId: userId,
          snapshot: makeWebsiteRevisionSnapshot(current, current.settings) as Prisma.InputJsonValue,
          changeNote: "Baseline snapshot",
        },
      });
    }

    const website = await tx.website.findUniqueOrThrow({
      where: { id: data.id },
      include: { settings: true },
    });
    await tx.contentVersion.create({
      data: {
        websiteId: data.id,
        resourceType: "WEBSITE",
        resourceId: data.id,
        version: website.version,
        authorId: userId,
        snapshot: makeWebsiteRevisionSnapshot(website, website.settings) as Prisma.InputJsonValue,
        changeNote: "Website updated",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: "website.update",
        resource: `Website:${data.id}`,
        metadata: { version: website.version },
      },
    });
    return website;
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