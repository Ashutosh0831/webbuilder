import { notFound } from "next/navigation";
import { requireAuth, requireWebsitePermission } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { BuilderShell } from "@/features/builder/components/builder-shell";

export default async function BuilderPage({ params }: { params: Promise<{ websiteId: string; pageId: string }> }) {
  const { websiteId, pageId } = await params;
  const user = await requireAuth();

  // Server-side permission check — before any builder code runs
  await requireWebsitePermission(user.id, websiteId, { resource: "page", action: "update" }, user.role ?? "editor");

  const page = await prisma.page.findFirst({
    where: { id: pageId, websiteId, deletedAt: null },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  if (!page) notFound();

  // Hydrate store on client (simplified — pass as props, hydrate in a wrapper)
  return <BuilderShell />;
}