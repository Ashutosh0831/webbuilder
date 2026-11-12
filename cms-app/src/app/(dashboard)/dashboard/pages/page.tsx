import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/authz";

export const instant = false;

export default async function PagesPage() {
  const user = await requireAuth();
  const pages = await prisma.page.findMany({
    where: {
      deletedAt: null,
      website: {
        deletedAt: null,
        ...(user.role === "super_admin" ? {} : { members: { some: { userId: user.id } } }),
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { website: { select: { id: true, name: true } } },
  });

  if (pages.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No pages yet"
        description="Pages from your assigned websites will appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pages</h1>
        <p className="text-muted-foreground">Recently updated pages from your websites.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pages ({pages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {pages.map((page) => (
              <li key={page.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <Link className="font-medium hover:underline" href={`/dashboard/pages/${page.id}`}>
                    {page.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    <Link href={`/dashboard/websites/${page.website.id}/pages`} className="hover:underline">
                      {page.website.name}
                    </Link>
                    {" · "}/{page.slug}{page.isHomepage ? " · Homepage" : ""}
                  </p>
                </div>
                <Badge variant={page.status === "PUBLISHED" ? "default" : "secondary"}>
                  {page.status}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Showing up to 100 recently updated pages.</p>
        </CardContent>
      </Card>
    </div>
  );
}
