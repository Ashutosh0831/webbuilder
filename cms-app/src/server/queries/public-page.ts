import { prisma } from "@/server/db/prisma";
import { cache } from "react";

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
      include: {
        versions: {
          where: { isPublished: true },
          orderBy: { version: "desc" },
          take: 1,
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