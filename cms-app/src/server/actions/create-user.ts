"use server";

import { auth } from "@/lib/auth";
import { requireSuperAdmin } from "@/server/authz";
import { headers } from "next/headers";

export async function createUserAction(formData: FormData) {
  await requireSuperAdmin(); // Only your super admin can do this

  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const password = formData.get("password") as string;
  const roleValue = formData.get("role");
  if (
    roleValue !== "editor" &&
    roleValue !== "super_admin" &&
    roleValue !== "website_owner"
  ) {
    return { error: "Invalid role" };
  }
  const role = roleValue; // Must be a role defined in your `roles` config in auth.ts

  try {
    const result = await auth.api.createUser({
      headers: await headers(),
      body: {
        email,
        password,
        name,
        role, // Must be a role defined in your `roles` config in auth.ts
      },
    });

    return { success: true, userId: result.user.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create user" };
  }
}