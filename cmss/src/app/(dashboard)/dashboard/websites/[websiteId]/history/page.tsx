import { notFound } from "next/navigation";
import { ContentVersionHistory } from "@/components/content-version-history";
import { requireAuth } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { getContentVersionHistory } from "@/server/services/content-history";

export default async function WebsiteHistoryPage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const user = await requireAuth();
  const website = await prisma.website.findFirst({
    where: { id: websiteId, deletedAt: null },
    select: { id: true, name: true, version: true },
  });
  if (!website) notFound();

  let versions;
  try {
    versions = await getContentVersionHistory(websiteId, user.id, user.role ?? "");
  } catch {
    notFound();
  }
  const themes = await prisma.websiteTheme.findMany({
    where: { websiteId },
    select: { themeId: true, theme: { select: { version: true } } },
  });
  const currentVersions = Object.fromEntries([
    [`WEBSITE:${websiteId}`, website.version],
    ...themes.map(({ themeId, theme }) => [`THEME:${themeId}`, theme.version]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{website.name} version history</h1>
        <p className="text-muted-foreground">Inspect, compare, and restore website and theme snapshots.</p>
      </div>
      <ContentVersionHistory
        websiteId={websiteId}
        versions={versions}
        currentVersions={currentVersions}
      />
    </div>
  );
}
