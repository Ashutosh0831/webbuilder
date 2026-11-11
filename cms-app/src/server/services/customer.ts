import { requireSuperAdmin } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { z } from "zod";
import type { createCustomerSchema, inviteUserSchema, customerFilterSchema } from "@/lib/validations/customer";

export async function createCustomer(data: z.infer<typeof createCustomerSchema>) {
  await requireSuperAdmin();

  return prisma.customer.create({
    data: { ...data, status: "PENDING" },
  });
}

export async function getCustomers(filter: z.infer<typeof customerFilterSchema>) {
  await requireSuperAdmin();

  const where = {
    deletedAt: null,
    ...(filter.status && { status: filter.status }),
    ...(filter.search && {
      OR: [
        { name: { contains: filter.search, mode: "insensitive" as const } },
        { contactEmail: { contains: filter.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { websites: true, users: true } } },
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers, total, totalPages: Math.ceil(total / filter.pageSize) };
}

export async function getCustomerById(id: string) {
  await requireSuperAdmin();

  return prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      users: { select: { id: true, email: true, name: true, status: true } },
      websites: { select: { id: true, name: true, slug: true, status: true } },
    },
  });
}

export async function activateCustomer(id: string) {
  await requireSuperAdmin();

  return prisma.customer.update({
    where: { id, deletedAt: null },
    data: { status: "ACTIVE" },
  });
}

export async function suspendCustomer(id: string) {
  await requireSuperAdmin();

  // 1. Suspend the customer
  const customer = await prisma.customer.update({
    where: { id, deletedAt: null },
    data: { status: "SUSPENDED" },
    include: { users: { select: { id: true } } },
  });

  // 2. Ban all users under this customer (revokes sessions)
  for (const user of customer.users) {
    await auth.api.banUser({
      headers: await headers(),
      body: {
        userId: user.id,
        banReason: "Customer suspended by administrator",
      },
    });
  }

  return customer;
}

export async function archiveCustomer(id: string) {
  await requireSuperAdmin();

  // Soft-archive: customer marked deleted, websites archived but NOT deleted
  return prisma.$transaction([
    prisma.website.updateMany({
      where: { customerId: id },
      data: { status: "ARCHIVED" },
    }),
    prisma.customer.update({
      where: { id },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    }),
  ]);
}

export async function inviteUserToCustomer(
  data: z.infer<typeof inviteUserSchema>
) {
  await requireSuperAdmin();

  // Create user via Better Auth admin plugin [citation:1]
  const result = await auth.api.createUser({
    headers: await headers(),
    body: {
      email: data.email,
      password: data.password,
      name: data.name,
      role: data.role,
    },
  });

  // Link to customer
  return prisma.user.update({
    where: { id: result.user.id },
    data: { customerId: data.customerId },
  });
}