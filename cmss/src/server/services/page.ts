import { requireWebsitePermission, NotFoundError } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
import {
  makePageRevisionSnapshot,
} from "@/server/services/versioning";
import type {
  createPageSchema, updatePageSchema, pageFilterSchema,
} from "@/lib/validations/page";

const SYSTEM_SLUGS = ["home", "404", "500"];

export async function createPage(
  data: z.infer<typeof createPageSchema>,
  userId: string,
  role: string
) {
  await requireWebsitePermission(userId, data.websiteId, { resource: "page", action: "create" }, role);

  // Prevent system slug collisions
  if (SYSTEM_SLUGS.includes(data.slug)) {
    throw new Error("This slug is reserved for system pages");
  }

  return prisma.page.create({
    data: {
      websiteId: data.websiteId,
      title: data.title,
      slug: data.slug,
      parentId: data.parentId ?? null,
      seo: data.seo ?? {},
      status: "DRAFT",
      versions: {
        create: {
          authorId: userId,
          version: 1,
          content: { sections: [] },
          snapshot: {
            title: data.title,
            slug: data.slug,
            seo: data.seo ?? null,
            template: null,
            parentId: data.parentId ?? null,
          },
          isPublished: false,
          changeNote: "Initial draft",
        },
      },
    },
    include: { versions: true },
  });
}

export async function getPages(
  filter: z.infer<typeof pageFilterSchema>,
  userId: string,
  role: string
) {
  await requireWebsitePermission(userId, filter.websiteId, { resource: "page", action: "read" }, role);

  const where = {
    websiteId: filter.websiteId,
    deletedAt: null,
    ...(filter.status && { status: filter.status }),
    ...(filter.search && {
      title: { contains: filter.search, mode: "insensitive" as const },
    }),
  };

  const [pages, total] = await Promise.all([
    prisma.page.findMany({
      where,
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      orderBy: [{ isHomepage: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { versions: true, children: true } },
      },
    }),
    prisma.page.count({ where }),
  ]);

  return { pages, total, totalPages: Math.ceil(total / filter.pageSize) };
}

export async function getPageById(pageId: string, userId: string, role: string) {
  const page = await prisma.page.findFirst({
    where: { id: pageId, deletedAt: null },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 50,
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      sections: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!page) throw new NotFoundError();

  await requireWebsitePermission(userId, page.websiteId, { resource: "page", action: "read" }, role);
  return page;
}

export async function updatePage(
  data: z.infer<typeof updatePageSchema>,
  userId: string,
  role: string
) {
  const page = await prisma.page.findFirst({ where: { id: data.id, deletedAt: null } });
  if (!page) throw new NotFoundError();

  await requireWebsitePermission(userId, page.websiteId, { resource: "page", action: "update" }, role);
  if (data.expectedVersion !== undefined && data.expectedVersion !== page.version) {
    throw new Error("This page was updated elsewhere. Reload before saving again.");
  }

  // Slug uniqueness within website
  if (data.slug && data.slug !== page.slug) {
    const collision = await prisma.page.findFirst({
      where: { websiteId: page.websiteId, slug: data.slug, deletedAt: null, NOT: { id: page.id } },
    });
    if (collision) throw new Error("A page with this slug already exists in this website");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.page.updateMany({
      where: { id: page.id, websiteId: page.websiteId, version: page.version, deletedAt: null },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.seo !== undefined && { seo: data.seo }),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new Error("This page was updated elsewhere. Reload before saving again.");
    }

    const currentPage = await tx.page.findUniqueOrThrow({ where: { id: page.id } });
    const latestVersion = await tx.pageVersion.findFirst({
      where: { pageId: page.id },
      orderBy: { version: "desc" },
    });

    return tx.pageVersion.create({
      data: {
        pageId: page.id,
        authorId: userId,
        version: (latestVersion?.version ?? 0) + 1,
        content: JSON.parse(JSON.stringify(data.content ?? latestVersion?.content ?? { sections: [] })) as Prisma.InputJsonValue,
        snapshot: makePageRevisionSnapshot(currentPage) as Prisma.InputJsonValue,
        isPublished: false,
        changeNote: "Page updated",
      },
    });
  });
}

export async function archivePage(pageId: string, userId: string, role: string) {
  const page = await prisma.page.findFirst({ where: { id: pageId, deletedAt: null } });
  if (!page) throw new NotFoundError();

  await requireWebsitePermission(userId, page.websiteId, { resource: "page", action: "delete" }, role);

  if (page.isSystem) throw new Error("System pages cannot be archived");

  return prisma.page.update({
    where: { id: pageId },
    data: { status: "ARCHIVED", deletedAt: new Date() },
  });
}

export async function duplicatePage(
  pageId: string,
  userId: string,
  role: string
) {
  const source = await prisma.page.findFirst({
    where: { id: pageId, deletedAt: null },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!source) throw new NotFoundError();

  await requireWebsitePermission(userId, source.websiteId, { resource: "page", action: "create" }, role);

  // Generate a unique slug within this website.
  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.page.findFirst({ where: { websiteId: source.websiteId, slug, deletedAt: null } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  // Builder content lives in PageVersion.content (not the legacy PageSection
  // relation). Clone that latest content and issue fresh IDs for every section.
  const rawContent = source.versions[0]?.content;
  const contentRecord = rawContent && typeof rawContent === "object" && !Array.isArray(rawContent)
    ? rawContent as Record<string, unknown>
    : {};
  const rawSections = Array.isArray(contentRecord.sections) ? contentRecord.sections : [];

  function cloneSection(value: unknown, index: number): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const section = value as Record<string, unknown>;
    if (typeof section.componentKey !== "string" || !section.props || typeof section.props !== "object") {
      return null;
    }
    const children = Array.isArray(section.children)
      ? section.children.map((child, childIndex) => cloneSection(child, childIndex)).filter(Boolean)
      : [];
    return {
      id: crypto.randomUUID(),
      componentKey: section.componentKey,
      props: section.props,
      sortOrder: index,
      ...(section.responsive && typeof section.responsive === "object"
        ? { responsive: section.responsive }
        : {}),
      children,
    };
  }

  const clonedSections = rawSections
    .map((section, index) => cloneSection(section, index))
    .filter((section): section is Record<string, unknown> => section !== null);
  const content = { sections: clonedSections };

  return prisma.page.create({
    data: {
      websiteId: source.websiteId,
      title: `${source.title} (Copy)`,
      slug,
      parentId: source.parentId,
      seo: source.seo ?? {},
      status: "DRAFT",
      versions: {
        create: {
          authorId: userId,
          version: 1,
          content: JSON.parse(JSON.stringify(content)) as Prisma.InputJsonValue,
          snapshot: {
            title: `${source.title} (Copy)`,
            slug,
            seo: source.seo ?? null,
            template: source.template,
            parentId: source.parentId,
          },
          isPublished: false,
          changeNote: `Duplicated from ${source.slug}`,
        },
      },
    },
  });
}

export async function setHomepage(pageId: string, userId: string, role: string) {
  const page = await prisma.page.findFirst({ where: { id: pageId, deletedAt: null } });
  if (!page) throw new NotFoundError();

  await requireWebsitePermission(userId, page.websiteId, { resource: "page", action: "update" }, role);

  // Atomic swap: unset previous homepage, set new one
  return prisma.$transaction([
    prisma.page.updateMany({
      where: { websiteId: page.websiteId, isHomepage: true },
      data: { isHomepage: false },
    }),
    prisma.page.update({ where: { id: pageId }, data: { isHomepage: true } }),
  ]);
}