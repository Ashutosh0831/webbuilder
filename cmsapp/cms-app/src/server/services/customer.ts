import { requireSuperAdmin } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { z } from "zod";
import type { createCustomerSchema, inviteUserSchema, customerFilterSchema } from "@/lib/validations/customer";

export async function createCustomer(data: z.infer<typeof createCustomerSchema>) {
  const admin = await requireSuperAdmin();

  const customer = await prisma.customer.create({
    data: { ...data, status: "ACTIVE" },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "customer.create",
      resource: `Customer:${customer.id}`,
      metadata: { name: customer.name, contactEmail: customer.contactEmail },
    },
  });

  return customer;
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
      users: { select: { id: true, email: true, name: true, status: true, role: true } },
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
  const admin = await requireSuperAdmin();

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, deletedAt: null },
    select: { id: true, status: true, name: true },
  });
  if (!customer) throw new Error("Customer not found");
  if (customer.status !== "ACTIVE") {
    throw new Error("Activate this customer before creating a login.");
  }

  const email = data.email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("An account with this email already exists. Use a different email.");
  }

  // Better Auth creates and securely hashes the password. The user is then linked
  // to this customer so the tenant dashboard can scope their websites correctly.
  const result = await auth.api.createUser({
    headers: await headers(),
    body: {
      email,
      password: data.password,
      name: data.name.trim(),
      role: data.role,
    },
  });

  const user = await prisma.user.update({
    where: { id: result.user.id },
    data: {
      customerId: customer.id,
      status: "ACTIVE",
      role: data.role,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "customer.user.create",
      resource: `User:${user.id}`,
      metadata: { customerId: customer.id, email, role: data.role },
    },
  });

  return user;
}
