"use server";

import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/server/db/prisma";
import { createUserSchema } from "@/lib/validations/auth";
import { headers } from "next/headers";

export async function createUserAction(formData: FormData) {
  const admin = await requireUser();
  if (admin.role !== "super_admin") {
    throw new Error("Forbidden");
  }

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
    customerId: formData.get("customerId") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const { email, name, password, role } = parsed.data;

  // Use Better Auth admin plugin to create user with hashed password
  const result = await auth.api.createUser({
    headers: await headers(),
    body: { email, password, name, role },
    returnHeaders: true,
    returnStatus: false,
  });

  // Optionally link to customer
  if (parsed.data.customerId) {
    await prisma.user.update({
      where: { email },
      data: { customerId: parsed.data.customerId },
    });
  }

  return { success: true, userId: result.response.user.id };
}