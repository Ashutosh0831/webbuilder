import { prisma } from "@/server/db/prisma";
import { cache } from "react";
import { resolveProps } from "@/features/builder/resolve";
import type { BuilderSection } from "@/features/builder/types";

/**
 * Resolve a published page by website + slug.
 * Returns null for drafts, archived pages, or missing slugs.
 */
export const resolvePublishedPage = cache(
  async (websiteId: string, slug: string | null) => {
    const page = await prisma.page.findFirst({
      where: {
        websiteId, // CRITICAL: scoped to the resolved website
        deletedAt: null,
        status: "PUBLISHED",
        ...(slug === null
          ? { isHomepage: true }
          : { slug }),
      },
      select: {
        id: true,
        title: true,
        seo: true,
        versions: {
          where: { isPublished: true },
          orderBy: { version: "desc" },
          take: 1,
          select: { content: true },
        },
      },
    });

    if (!page || !page.versions[0]) return null;

    return {
      page,
      publishedContent: page.versions[0].content as {
        sections?: import("@/features/components/types").StoredSection[];
      },
    };
  }
);

// src/server/queries/public-page.ts (in the page resolver)
export function resolveAllBreakpoints(section: BuilderSection) {
  return {
    mobile: section.props,
    tablet: resolveProps(section, "tablet"),
    desktop: resolveProps(section, "desktop"),
  };
}