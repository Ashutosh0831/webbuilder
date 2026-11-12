"use server";

import { revalidatePath } from "next/cache";
import { createCustomerSchema, inviteUserSchema } from "@/lib/validations/customer";
import * as customerService from "@/server/services/customer";

export async function createCustomerAction(formData: FormData) {
  const parsed = createCustomerSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company") || undefined,
    contactEmail: formData.get("contactEmail"),
    plan: formData.get("plan") || "free",
    websiteQuota: formData.get("websiteQuota") || 3,
    storageQuota: formData.get("storageQuota") || 1073741824,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await customerService.createCustomer(parsed.data);
    revalidatePath("/admin/customers");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create customer" };
  }
}

export async function suspendCustomerAction(id: string) {
  try {
    await customerService.suspendCustomer(id);
    revalidatePath("/admin/customers");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to suspend customer" };
  }
}

export async function inviteUserAction(formData: FormData) {
  const parsed = inviteUserSchema.safeParse({
    customerId: formData.get("customerId"),
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const user = await customerService.inviteUserToCustomer(parsed.data);
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${parsed.data.customerId}`);
    revalidatePath("/admin/users");
    return { success: true, userId: user.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to invite user" };
  }
}
export async function activateCustomerAction(id: string) {
  try {
    await customerService.activateCustomer(id);
    revalidatePath(`/admin/customers/${id}`);
    revalidatePath("/admin/customers");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to activate customer" };
  }
}
