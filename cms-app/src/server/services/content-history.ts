import { requireWebsitePermission } from "@/server/authz";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import {
  makeThemeRevisionSnapshot,
  makeWebsiteRevisionSnapshot,
  themeRevisionSnapshotSchema,
  websiteRevisionSnapshotSchema,
} from "@/server/services/versioning";

export async function getContentVersionHistory(
  websiteId: string,
  userId: string,
  role: string
) {
  await requireWebsitePermission(userId, websiteId, { resource: "page", action: "read" }, role);
  return prisma.contentVersion.findMany({
    where: { websiteId },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
    take: 200,
  });
}

export async function restoreContentVersion(
  websiteId: string,
  versionId: string,
  expectedVersion: number,
  userId: string,
  role: string
) {
  await requireWebsitePermission(userId, websiteId, { resource: "website", action: "update" }, role);
  const revision = await prisma.contentVersion.findFirst({
    where: { id: versionId, websiteId },
  });
  if (!revision) throw new Error("Version not found");

  if (revision.resourceType === "WEBSITE") {
    const snapshotResult = websiteRevisionSnapshotSchema.safeParse(revision.snapshot);
    if (!snapshotResult.success) throw new Error("This website revision is invalid and cannot be restored");
    const snapshot = snapshotResult.data;
    const current = await prisma.website.findFirst({
      where: { id: websiteId, deletedAt: null },
      include: { settings: true },
    });
    if (!current || revision.resourceId !== current.id) throw new Error("Version not found");
    if (current.version !== expectedVersion) throw new Error("This website changed during restoration. Reload and try again.");
    if (snapshot.slug !== current.slug) {
      const collision = await prisma.website.findFirst({
        where: { customerId: current.customerId, slug: snapshot.slug, deletedAt: null, NOT: { id: websiteId } },
        select: { id: true },
      });
      if (collision) throw new Error("Cannot restore this revision because its slug is now in use.");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.website.updateMany({
        where: { id: websiteId, version: expectedVersion, deletedAt: null },
        data: {
          name: snapshot.name,
          slug: snapshot.slug,
          description: snapshot.description,
          locale: snapshot.locale,
          timezone: snapshot.timezone,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error("This website changed during restoration. Reload and try again.");

      const restoredSettings = {
        ...snapshot.settings,
        defaultSeo: snapshot.settings.defaultSeo === null
          ? Prisma.JsonNull
          : snapshot.settings.defaultSeo as Prisma.InputJsonValue,
      };
      await tx.websiteSettings.upsert({
        where: { websiteId },
        create: { websiteId, ...restoredSettings },
        update: restoredSettings,
      });
      const website = await tx.website.findUniqueOrThrow({
        where: { id: websiteId },
        include: { settings: true },
      });
      await tx.contentVersion.create({
        data: {
          websiteId,
          resourceType: "WEBSITE",
          resourceId: websiteId,
          version: website.version,
          authorId: userId,
          snapshot: makeWebsiteRevisionSnapshot(website, website.settings) as Prisma.InputJsonValue,
          changeNote: `Restored from website version ${revision.version}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "website.version.restore",
          resource: `Website:${websiteId}`,
          metadata: { sourceVersionId: revision.id, sourceVersion: revision.version, restoredVersion: website.version },
        },
      });
      return website;
    });
  }

  const snapshotResult = themeRevisionSnapshotSchema.safeParse(revision.snapshot);
  if (!snapshotResult.success) throw new Error("This theme revision is invalid and cannot be restored");
  const snapshot = snapshotResult.data;
  const assignment = await prisma.websiteTheme.findUnique({
    where: { websiteId_themeId: { websiteId, themeId: revision.resourceId } },
    include: { theme: true },
  });
  if (!assignment) throw new Error("This theme is no longer assigned to the website");
  if (assignment.theme.version !== expectedVersion) {
    throw new Error("This theme changed during restoration. Reload and try again.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.theme.updateMany({
      where: { id: revision.resourceId, version: expectedVersion },
      data: { name: snapshot.name, tokens: snapshot.tokens, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new Error("This theme changed during restoration. Reload and try again.");

    const theme = await tx.theme.findUniqueOrThrow({ where: { id: revision.resourceId } });
    await tx.contentVersion.create({
      data: {
        websiteId,
        resourceType: "THEME",
        resourceId: theme.id,
        version: theme.version,
        authorId: userId,
        snapshot: makeThemeRevisionSnapshot(theme) as Prisma.InputJsonValue,
        changeNote: `Restored from theme version ${revision.version}`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: "theme.version.restore",
        resource: `Theme:${theme.id}`,
        metadata: { websiteId, sourceVersionId: revision.id, sourceVersion: revision.version, restoredVersion: theme.version },
      },
    });
    return theme;
  });
}
