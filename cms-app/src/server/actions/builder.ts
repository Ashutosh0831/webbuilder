"use server";

import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { saveDraftSchema } from "@/lib/validations/builder";
import { makePageRevisionSnapshot } from "@/server/services/versioning";

export async function saveDraftAction(input: unknown) {
  const user = await requireAuth();
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid data", issues: parsed.error.issues };
  }

  const { pageId, websiteId, version, sections } = parsed.data;

  // Server-side permission — never trust the client
  await requireWebsitePermission(user.id, websiteId, { resource: "page", action: "update" }, user.role ?? "editor");

  const saved = await prisma.$transaction(async (tx) => {
    const updated = await tx.page.updateMany({
      where: { id: pageId, websiteId, version, deletedAt: null },
      data: { version: { increment: 1 } },
    });
    if (updated.count !== 1) return false;

    const [page, latest] = await Promise.all([
      tx.page.findFirstOrThrow({ where: { id: pageId, websiteId } }),
      tx.pageVersion.findFirst({
        where: { pageId },
        orderBy: { version: "desc" },
        select: { version: true },
      }),
    ]);

    await tx.pageVersion.create({
      data: {
        pageId,
        authorId: user.id,
        version: (latest?.version ?? 0) + 1,
        content: JSON.parse(JSON.stringify({ sections })) as Prisma.InputJsonValue,
        snapshot: makePageRevisionSnapshot(page) as Prisma.InputJsonValue,
        isPublished: false,
        changeNote: "Autosave",
      },
    });
    return true;
  });

  if (!saved) {
    return { error: "conflict", message: "This page was updated elsewhere. Reload to see the latest version." };
  }

  // Fetch the new version number to return to the client
  return { success: true, newVersion: version + 1 };
}