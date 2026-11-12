import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { themeTokensSchema } from "@/lib/validations/themes";
import { makeThemeRevisionSnapshot } from "@/server/services/versioning";

export async function createTheme(
  websiteId: string,
  name: string,
  tokens: unknown,
  expectedVersion?: number
) {
  const user = await requireAuth();
  await requireWebsitePermission(user.id, websiteId, { resource: "website", action: "update" }, user.role ?? "editor");

  const parsed = themeTokensSchema.safeParse(tokens);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  return prisma.$transaction(async (tx) => {
    const active = await tx.websiteTheme.findFirst({
      where: { websiteId, isActive: true },
      include: { theme: true },
    });

    if (active) {
      if (expectedVersion !== undefined && active.theme.version !== expectedVersion) {
        throw new Error("This theme was updated elsewhere. Reload before saving again.");
      }
      const updated = await tx.theme.updateMany({
        where: { id: active.themeId, version: active.theme.version },
        data: { name, tokens: parsed.data, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new Error("This theme was updated elsewhere. Reload before saving again.");

      const theme = await tx.theme.findUniqueOrThrow({ where: { id: active.themeId } });
      const prior = await tx.contentVersion.findFirst({
        where: { websiteId, resourceType: "THEME", resourceId: theme.id },
        select: { id: true },
      });
      if (!prior) {
        await tx.contentVersion.create({
          data: {
            websiteId,
            resourceType: "THEME",
            resourceId: theme.id,
            version: active.theme.version,
            authorId: user.id,
            snapshot: makeThemeRevisionSnapshot(active.theme) as Prisma.InputJsonValue,
            changeNote: "Baseline snapshot",
          },
        });
      }
      await tx.contentVersion.create({
        data: {
          websiteId,
          resourceType: "THEME",
          resourceId: theme.id,
          version: theme.version,
          authorId: user.id,
          snapshot: makeThemeRevisionSnapshot(theme) as Prisma.InputJsonValue,
          changeNote: "Theme updated",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "theme.update",
          resource: `Theme:${theme.id}`,
          metadata: { websiteId, version: theme.version },
        },
      });
      return theme;
    }

    if (expectedVersion !== undefined && expectedVersion !== 0) {
      throw new Error("This theme is no longer available. Reload before saving again.");
    }

    const theme = await tx.theme.create({
      data: { name, tokens: parsed.data, version: 1 },
    });
    await tx.websiteTheme.create({ data: { websiteId, themeId: theme.id, isActive: true } });
    await tx.contentVersion.create({
      data: {
        websiteId,
        resourceType: "THEME",
        resourceId: theme.id,
        version: theme.version,
        authorId: user.id,
        snapshot: makeThemeRevisionSnapshot(theme) as Prisma.InputJsonValue,
        changeNote: "Initial theme snapshot",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "theme.create",
        resource: `Theme:${theme.id}`,
        metadata: { websiteId, version: theme.version },
      },
    });
    return theme;
  });
}

export async function updateTheme(
  themeId: string,
  websiteId: string,
  tokens: unknown,
  expectedVersion?: number
) {
  const user = await requireAuth();
  await requireWebsitePermission(user.id, websiteId, { resource: "website", action: "update" }, user.role ?? "editor");

  const parsed = themeTokensSchema.safeParse(tokens);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const assignment = await prisma.websiteTheme.findUnique({
    where: { websiteId_themeId: { websiteId, themeId } },
    include: { theme: true },
  });
  if (!assignment) throw new Error("Theme is not assigned to this website");
  if (expectedVersion !== undefined && assignment.theme.version !== expectedVersion) {
    throw new Error("This theme was updated elsewhere. Reload before saving again.");
  }

  return prisma.$transaction(async (tx) => {
    const changed = await tx.theme.updateMany({
      where: { id: themeId, version: assignment.theme.version },
      data: { tokens: parsed.data, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new Error("This theme was updated elsewhere. Reload before saving again.");

    const theme = await tx.theme.findUniqueOrThrow({ where: { id: themeId } });
    const prior = await tx.contentVersion.findFirst({
      where: { websiteId, resourceType: "THEME", resourceId: themeId },
      select: { id: true },
    });
    if (!prior) {
      await tx.contentVersion.create({
        data: {
          websiteId,
          resourceType: "THEME",
          resourceId: themeId,
          version: assignment.theme.version,
          authorId: user.id,
          snapshot: makeThemeRevisionSnapshot(assignment.theme) as Prisma.InputJsonValue,
          changeNote: "Baseline snapshot",
        },
      });
    }
    await tx.contentVersion.create({
      data: {
        websiteId,
        resourceType: "THEME",
        resourceId: themeId,
        version: theme.version,
        authorId: user.id,
        snapshot: makeThemeRevisionSnapshot(theme) as Prisma.InputJsonValue,
        changeNote: "Theme updated",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "theme.update",
        resource: `Theme:${themeId}`,
        metadata: { websiteId, version: theme.version },
      },
    });
    return theme;
  });
}

export async function getActiveTheme(websiteId: string) {
  const link = await prisma.websiteTheme.findFirst({
    where: { websiteId, isActive: true },
    include: { theme: true },
  });
  if (!link) return null;
  const parsed = themeTokensSchema.safeParse(link.theme.tokens);
  return parsed.success ? { ...link.theme, tokens: parsed.data } : null;
}
