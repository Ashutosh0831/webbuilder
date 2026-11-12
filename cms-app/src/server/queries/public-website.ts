import { prisma } from "@/server/db/prisma";
import { cache } from "react";

/**
 * Resolve a Website from a hostname. Only returns ACTIVE websites
 * with a VERIFIED domain. Never trusts the hostname alone — the
 * domain must exist in the database.
 */
export const resolveWebsiteByDomain = cache(async (domain: string) => {
  return prisma.website.findFirst({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      customer: { deletedAt: null, status: "ACTIVE" },
      domains: {
        some: {
          domain,
          status: { in: ["VERIFIED", "ACTIVE"] },
        },
      },
    },
    select: {
      id: true,
      name: true,
      locale: true,
      slug: true,
      settings: { select: { defaultSeo: true, robotsTxt: true } },
      themes: {
        where: { isActive: true },
        select: { theme: { select: { tokens: true } } },
        take: 1,
      },
    },
  });
});