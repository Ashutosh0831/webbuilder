"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/server/authz";
import * as pageService from "@/server/services/page";
import { restorePageVersion } from "@/server/services/versioning";
import {
  createPageSchema,
  restorePageVersionSchema,
  updatePageSchema,
  pageContentSchema,
} from "@/lib/validations/page";

export async function createPageAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = createPageSchema.safeParse({
    websiteId: formData.get("websiteId"),
    title: formData.get("title"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const page = await pageService.createPage(parsed.data, user.id, user.role ?? "");
    revalidatePath(`/dashboard/websites/${parsed.data.websiteId}/pages`);
    return { success: true, pageId: page.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create page" };
  }
}

export async function updatePageAction(formData: FormData) {
  const user = await requireAuth();
  const contentRaw = formData.get("content");
  const content = contentRaw ? pageContentSchema.safeParse(JSON.parse(String(contentRaw))) : null;

  const parsed = updatePageSchema.safeParse({
    id: formData.get("id"),
    expectedVersion: Number(formData.get("expectedVersion")),
    title: formData.get("title") || undefined,
    slug: formData.get("slug") || undefined,
    content: content?.success ? content.data : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await pageService.updatePage(parsed.data, user.id, user.role ?? "");
    revalidatePath(`/dashboard/pages/${parsed.data.id}`);
    return { success: true, expectedVersion: parsed.data.expectedVersion + 1 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update page" };
  }
}

export async function restorePageVersionAction(input: unknown) {
  const parsed = restorePageVersionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await restorePageVersion(
      parsed.data.versionId,
      parsed.data.pageId,
      parsed.data.websiteId,
      parsed.data.expectedVersion,
    );
    revalidatePath(`/dashboard/pages/${parsed.data.pageId}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to restore page revision" };
  }
}

export async function archivePageAction(pageId: string) {
  const user = await requireAuth();
  try {
    await pageService.archivePage(pageId, user.id, user.role ?? "");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to archive page" };
  }
}

export async function duplicatePageAction(pageId: string) {
  const user = await requireAuth();
  try {
    const page = await pageService.duplicatePage(pageId, user.id, user.role ?? "");
    revalidatePath("/dashboard");
    return { success: true, pageId: page.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to duplicate page" };
  }
}

export async function setHomepageAction(pageId: string) {
  const user = await requireAuth();
  try {
    await pageService.setHomepage(pageId, user.id, user.role ?? "");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to set homepage" };
  }
}