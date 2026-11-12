"use server";

import { requireSuperAdmin, requireAuth, requireWebsitePermission } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { revalidatePath } from "next/cache";

export async function deleteWebsiteAction(websiteId: string) {
  await requireSuperAdmin(); // Only super admins can delete websites

  try {
    await prisma.website.update({
      where: { id: websiteId },
      data: { deletedAt: new Date(), status: "ARCHIVED" }, // Soft delete
    });
    revalidatePath("/admin/websites");
    revalidatePath("/dashboard/websites");
    return { success: true };
  } catch (e) {
    return { error: "Failed to delete website" };
  }
}

export async function deletePageAction(pageId: string, websiteId: string) {
  const user = await requireAuth();
  // Check if they have permission to delete pages on this website
  await requireWebsitePermission(user.id, websiteId, { resource: "page", action: "delete" }, user.role ?? "editor");

  try {
    await prisma.page.update({
      where: { id: pageId },
      data: { deletedAt: new Date(), status: "ARCHIVED" }, // Soft delete
    });
    revalidatePath(`/dashboard/websites/${websiteId}/pages`);
    return { success: true };
  } catch (e) {
    return { error: "Failed to delete page" };
  }
}