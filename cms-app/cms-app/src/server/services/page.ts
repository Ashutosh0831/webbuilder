import { requireWebsitePermission, NotFoundError } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { z } from "zod";
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
        take: 10,
        select: { id: true, version: true, isPublished: true, createdAt: true, changeNote: true },
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

  // If content supplied, create a new draft version (do not mutate published)
  if (data.content) {
    const lastVersion = await prisma.pageVersion.findFirst({
      where: { pageId: page.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    await prisma.pageVersion.create({
      data: {
        pageId: page.id,
        authorId: userId,
        version: nextVersion,
        content: JSON.parse(JSON.stringify(data.content)) as Prisma.InputJsonValue,
        isPublished: false,
        changeNote: "Draft update",
      },
    });
  }

  // Slug uniqueness within website
  if (data.slug && data.slug !== page.slug) {
    const collision = await prisma.page.findFirst({
      where: { websiteId: page.websiteId, slug: data.slug, deletedAt: null, NOT: { id: page.id } },
    });
    if (collision) throw new Error("A page with this slug already exists in this website");
  }

  return prisma.page.update({
    where: { id: page.id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.slug && { slug: data.slug }),
      ...(data.seo && { seo: data.seo }),
    },
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
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) throw new NotFoundError();

  await requireWebsitePermission(userId, source.websiteId, { resource: "page", action: "create" }, role);

  // Generate unique slug
  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.page.findFirst({ where: { websiteId: source.websiteId, slug, deletedAt: null } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const content = { sections: source.sections.map((s) => ({
    id: crypto.randomUUID(),
    componentType: s.componentDefId,
    props: s.props,
    sortOrder: s.sortOrder,
  })) };

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