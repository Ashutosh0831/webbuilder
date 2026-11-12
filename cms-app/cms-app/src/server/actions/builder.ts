"use server";

import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { saveDraftSchema } from "@/lib/validations/builder";

export async function saveDraftAction(input: unknown) {
  const user = await requireAuth();
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid data", issues: parsed.error.issues };
  }

  const { pageId, websiteId, version, sections } = parsed.data;

  // Server-side permission — never trust the client
  await requireWebsitePermission(user.id, websiteId, { resource: "page", action: "update" }, user.role ?? "editor");

  // Optimistic lock: only update if version matches [citation:4][citation:10]
  const result = await prisma.page.updateMany({
    where: { id: pageId, websiteId, version, deletedAt: null },
    data: {
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  if (result.count === 0) {
    // Either the page doesn't exist, the version changed, or the user lost access
    return { error: "conflict", message: "This page was updated elsewhere. Reload to see the latest version." };
  }

  // Create a new immutable PageVersion with the draft content
  const latest = await prisma.pageVersion.findFirst({
    where: { pageId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  await prisma.pageVersion.create({
    data: {
      pageId,
      authorId: user.id,
      version: (latest?.version ?? 0) + 1,
      content: JSON.parse(JSON.stringify({ sections })),
      isPublished: false,
      changeNote: "Autosave",
    },
  });

  // Fetch the new version number to return to the client
  return { success: true, newVersion: version + 1 };
}