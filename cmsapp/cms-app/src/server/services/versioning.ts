import { z } from "zod";
import { pageContentSchema, pageSeoSchema } from "@/lib/validations/page";
import { themeTokensSchema } from "@/lib/validations/themes";
import { sectionSchema } from "@/lib/validations/builder";
import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/server/authz";

const builderPageContentSchema = z.object({
  sections: z.array(sectionSchema),
});

export const pageRevisionSnapshotSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(80),
  seo: pageSeoSchema.nullable(),
  template: z.string().nullable(),
  parentId: z.string().uuid().nullable(),
});

export const websiteRevisionSnapshotSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(50),
  description: z.string().max(500).nullable(),
  locale: z.enum(["en", "es", "fr", "de"]),
  timezone: z.string(),
  settings: z.object({
    robotsTxt: z.string().nullable(),
    faviconUrl: z.string().nullable(),
    defaultSeo: z.unknown().nullable(),
  }),
});

export const themeRevisionSnapshotSchema = z.object({
  name: z.string().min(1).max(100),
  tokens: themeTokensSchema,
});

export function validatePageRevision(content: unknown, snapshot: unknown) {
  const parsedSnapshot = pageRevisionSnapshotSchema.safeParse(snapshot);
  if (!parsedSnapshot.success) {
    throw new Error("This revision has invalid page metadata and cannot be restored");
  }
  if (!pageContentSchema.safeParse(content).success && !builderPageContentSchema.safeParse(content).success) {
    throw new Error("This revision has invalid page content and cannot be restored");
  }
  return parsedSnapshot.data;
}

export function changedSnapshotKeys(before: unknown, after: unknown) {
  const beforeRecord = before && typeof before === "object" ? before as Record<string, unknown> : {};
  const afterRecord = after && typeof after === "object" ? after as Record<string, unknown> : {};
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  return [...keys].filter((key) =>
    JSON.stringify(beforeRecord[key]) !== JSON.stringify(afterRecord[key])
  );
}

export function makePageRevisionSnapshot(page: {
  title: string;
  slug: string;
  seo: unknown;
  template: string | null;
  parentId: string | null;
}) {
  return {
    title: page.title,
    slug: page.slug,
    seo: page.seo ?? null,
    template: page.template,
    parentId: page.parentId,
  };
}

export function makeWebsiteRevisionSnapshot(
  website: {
    name: string;
    slug: string;
    description: string | null;
    locale: string;
    timezone: string;
  },
  settings: {
    robotsTxt: string | null;
    faviconUrl: string | null;
    defaultSeo: unknown;
  } | null
) {
  return {
    name: website.name,
    slug: website.slug,
    description: website.description,
    locale: website.locale,
    timezone: website.timezone,
    settings: {
      robotsTxt: settings?.robotsTxt ?? null,
      faviconUrl: settings?.faviconUrl ?? null,
      defaultSeo: settings?.defaultSeo ?? null,
    },
  };
}

export function makeThemeRevisionSnapshot(theme: { name: string; tokens: unknown }) {
  return { name: theme.name, tokens: theme.tokens };
}


export async function listPageVersions(pageId: string, websiteId: string) {
  const user = await requireAuth();
  await requireWebsitePermission(user.id, websiteId, { resource: "page", action: "read" }, user.role ?? "editor");

  // Verify the page belongs to the website before listing
  const page = await prisma.page.findFirst({
    where: { id: pageId, websiteId, deletedAt: null },
    select: { id: true },
  });
  if (!page) throw new Error("Page not found");

  return prisma.pageVersion.findMany({
    where: { pageId },
    orderBy: { version: "desc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function comparePageVersions(
  versionAId: string,
  versionBId: string,
  websiteId: string
) {
  const user = await requireAuth();
  await requireWebsitePermission(
    user.id,
    websiteId,
    { resource: "page", action: "read" },
    user.role ?? "editor"
  );

  const [versionA, versionB] = await Promise.all([
    prisma.pageVersion.findFirst({
      where: { id: versionAId, page: { websiteId } },
      select: { id: true, pageId: true, version: true, content: true, createdAt: true },
    }),
    prisma.pageVersion.findFirst({
      where: { id: versionBId, page: { websiteId } },
      select: { id: true, pageId: true, version: true, content: true, createdAt: true },
    }),
  ]);

  if (!versionA || !versionB) throw new Error("Version not found");
  if (versionA.pageId !== versionB.pageId) {
    throw new Error("Versions belong to different pages");
  }

  return {
    versionA: {
      id: versionA.id,
      version: versionA.version,
      content: versionA.content,
      createdAt: versionA.createdAt,
    },
    versionB: {
      id: versionB.id,
      version: versionB.version,
      content: versionB.content,
      createdAt: versionB.createdAt,
    },
  };
}

export async function restorePageVersion(
  versionId: string,
  pageId: string,
  websiteId: string,
  expectedVersion: number
) {
  const user = await requireAuth();
  await requireWebsitePermission(
    user.id,
    websiteId,
    { resource: "page", action: "update" },
    user.role ?? "editor"
  );

  return prisma.$transaction(async (tx) => {
    const page = await tx.page.findFirst({
      where: { id: pageId, websiteId, deletedAt: null },
    });
    if (!page) throw new NotFoundError();
    if (page.version !== expectedVersion) {
      throw new Error("This page changed during restoration. Reload and try again.");
    }

    const sourceVersion = await tx.pageVersion.findFirst({
      where: { id: versionId, pageId, page: { websiteId } },
    });
    if (!sourceVersion) throw new Error("Version not found");

    const snapshot = sourceVersion.snapshot
      ? validatePageRevision(sourceVersion.content, sourceVersion.snapshot)
      : makePageRevisionSnapshot(page);
    validatePageRevision(sourceVersion.content, snapshot);

    if (snapshot.slug !== page.slug) {
      const collision = await tx.page.findFirst({
        where: { websiteId, slug: snapshot.slug, deletedAt: null, NOT: { id: pageId } },
        select: { id: true },
      });
      if (collision) throw new Error("Cannot restore this revision because its slug is now in use.");
    }

    const updated = await tx.page.updateMany({
      where: { id: pageId, websiteId, version: expectedVersion, deletedAt: null },
      data: {
        title: snapshot.title,
        slug: snapshot.slug,
        seo: snapshot.seo ?? Prisma.JsonNull,
        template: snapshot.template,
        parentId: snapshot.parentId,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new Error("This page changed during restoration. Reload and try again.");
    }

    const latest = await tx.pageVersion.findFirst({
      where: { pageId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const restored = await tx.pageVersion.create({
      data: {
        pageId,
        authorId: user.id,
        version: (latest?.version ?? 0) + 1,
        content: sourceVersion.content as Prisma.InputJsonValue,
        snapshot: snapshot as Prisma.InputJsonValue,
        isPublished: false,
        changeNote: `Restored from version ${sourceVersion.version} by ${user.name ?? user.email}`,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "page.version.restore",
        resource: `Page:${pageId}`,
        metadata: {
          sourceVersionId: sourceVersion.id,
          sourceVersion: sourceVersion.version,
          restoredVersion: restored.version,
        },
      },
    });

    return restored;
  });
}