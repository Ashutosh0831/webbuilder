"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireWebsitePermission } from "@/server/authz";
import {
  compareVersionsSchema,
  restoreContentVersionSchema,
  restoreVersionSchema,
} from "@/lib/validations/versioning";
import { restoreContentVersion } from "@/server/services/content-history";
import { comparePageVersions } from "@/server/services/versioning";
import { restorePageVersion } from "@/server/services/versioning";
import { prisma } from "@/server/db/prisma";

export async function restoreVersionAction(versionId: string, pageId: string, websiteId: string) {
  const parsed = restoreVersionSchema.safeParse({ versionId, pageId, websiteId });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await requireAuth();
  try {
    await requireWebsitePermission(
      user.id,
      parsed.data.websiteId,
      { resource: "page", action: "update" },
      user.role ?? "editor"
    );
    const page = await prisma.page.findFirst({
      where: { id: parsed.data.pageId, websiteId: parsed.data.websiteId, deletedAt: null },
      select: { version: true },
    });
    if (!page) return { error: "Page not found" };

    const restored = await restorePageVersion(
      parsed.data.versionId,
      parsed.data.pageId,
      parsed.data.websiteId,
      page.version
    );
    revalidatePath(`/dashboard/pages/${parsed.data.pageId}`);
    return { success: true, newVersion: restored.version };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to restore page revision" };
  }
}

export async function comparePageVersionsAction(input: unknown) {
  const parsed = compareVersionsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const comparison = await comparePageVersions(
      parsed.data.versionAId,
      parsed.data.versionBId,
      parsed.data.websiteId
    );
    return { success: true, comparison };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to compare page revisions" };
  }
}

export async function restoreContentVersionAction(input: unknown) {
  const parsed = restoreContentVersionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await requireAuth();
  try {
    await restoreContentVersion(
      parsed.data.websiteId,
      parsed.data.versionId,
      parsed.data.expectedVersion,
      user.id,
      user.role ?? ""
    );
    revalidatePath(`/dashboard/websites/${parsed.data.websiteId}/history`);
    revalidatePath(`/dashboard/websites/${parsed.data.websiteId}/pages`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to restore content revision" };
  }
}
