import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/authz";

export const instant = false;

export default async function WebsitesPage() {
  const user = await requireAuth();
  const websites = await prisma.website.findMany({
    where: {
      deletedAt: null,
      ...(user.role === "super_admin" ? {} : { members: { some: { userId: user.id } } }),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      _count: { select: { pages: true, media: true } },
    },
  });

  if (websites.length === 0) {
    return (
      <EmptyState
        icon={Globe}
        title="No websites yet"
        description="Websites assigned to your account will appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Websites</h1>
          <p className="text-muted-foreground">Manage content across your websites.</p>
        </div>
        {user.role === "super_admin" && (
          <Button nativeButton={false} render={<Link href="/admin/websites/new" />}>Create website</Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your websites ({websites.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {websites.map((website) => (
              <li key={website.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <Link
                    className="font-medium hover:underline"
                    href={`/dashboard/websites/${website.id}/pages`}
                  >
                    {website.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {website.slug} · {website._count.pages} pages · {website._count.media} media files
                  </p>
                </div>
                <Badge variant={website.status === "ACTIVE" ? "default" : "secondary"}>
                  {website.status}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
