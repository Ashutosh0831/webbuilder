"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/server/authz";
import * as websiteService from "@/server/services/website";
import { createWebsiteSchema, updateWebsiteSchema } from "@/lib/validations/website";

export async function createWebsiteAction(formData: FormData) {
  const parsed = createWebsiteSchema.safeParse({
    customerId: formData.get("customerId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    locale: formData.get("locale") || "en",
    timezone: formData.get("timezone") || "UTC",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const website = await websiteService.createWebsite(parsed.data);
    revalidatePath("/admin/websites");
    revalidatePath(`/admin/customers/${parsed.data.customerId}`);
    return { success: true, websiteId: website.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create website" };
  }
}

export async function updateWebsiteAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = updateWebsiteSchema.safeParse({
    id: formData.get("id"),
    expectedVersion: formData.has("expectedVersion")
      ? Number(formData.get("expectedVersion"))
      : undefined,
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    locale: formData.get("locale") || undefined,
    timezone: formData.get("timezone") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await websiteService.updateWebsite(parsed.data, user.id, user.role ?? "");
    revalidatePath(`/admin/websites/${parsed.data.id}`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update website" };
  }
}

export async function archiveWebsiteAction(id: string) {
  try {
    await websiteService.archiveWebsite(id);
    revalidatePath("/admin/websites");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to archive website" };
  }
}

export async function assignEditorAction(websiteId: string, userId: string, roleId: string) {
  try {
    await websiteService.assignEditor(websiteId, userId, roleId);
    revalidatePath(`/admin/websites/${websiteId}`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to assign editor" };
  }
}