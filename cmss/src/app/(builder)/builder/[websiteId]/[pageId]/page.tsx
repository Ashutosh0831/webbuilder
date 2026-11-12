import { notFound } from "next/navigation";
import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { BuilderShell } from "@/features/builder/components/builder-shell";
import type { BuilderSection } from "@/features/builder/types";
import { sectionSchema } from "@/lib/validations/builder";
import { z } from "zod";

const builderSectionsSchema = z.array(sectionSchema);

export const instant = false;

export default async function BuilderPage({ params }: { params: Promise<{ websiteId: string; pageId: string }> }) {
  const { websiteId, pageId } = await params;
  const user = await requireAuth();

  // Server-side permission check — before any builder code runs
  await requireWebsitePermission(user.id, websiteId, { resource: "page", action: "update" }, user.role ?? "editor");

  const page = await prisma.page.findFirst({
    where: { id: pageId, websiteId, deletedAt: null },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!page) notFound();

  const content = page.versions[0]?.content;
  const rawSections = content !== null && typeof content === "object" &&
    !Array.isArray(content) && "sections" in content
    ? content.sections
    : undefined;
  const parsedSections = builderSectionsSchema.safeParse(rawSections);
  const sections = parsedSections.success
    ? rawSections as unknown as BuilderSection[]
    : [];

  return (
    <BuilderShell
      initial={{
        websiteId,
        pageId,
        pageTitle: page.title,
        version: page.version,
        sections,
      }}
    />
  );
}