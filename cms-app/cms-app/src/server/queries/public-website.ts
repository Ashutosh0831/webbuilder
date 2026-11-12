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
    include: {
      settings: true,
      themes: {
        where: { isActive: true },
        include: { theme: true },
        take: 1,
      },
    },
  });
});