import Link from "next/link";
import { notFound } from "next/navigation";
import { getPages } from "@/server/services/page";
import { requireAuth } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { pageFilterSchema } from "@/lib/validations/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FileText } from "lucide-react";

export default async function PagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ websiteId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { websiteId } = await params;
  const sp = await searchParams;
  const user = await requireAuth();

  // Verify website exists
  const website = await prisma.website.findFirst({ where: { id: websiteId, deletedAt: null } });
  if (!website) notFound();

  let data;
  try {
    data = await getPages(pageFilterSchema.parse({ ...sp, websiteId }), user.id, user.role ?? "");
  } catch {
    notFound();
  }

  if (data.pages.length === 0 && !sp.search) {
    return <EmptyState icon={FileText} title="No pages yet" description="Create your first page." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{website.name} — Pages</h1>
          <p className="text-sm text-muted-foreground">{data.total} total</p>
        </div>
        <Button render={<Link href={`/dashboard/websites/${websiteId}/pages/new`}/>}>
          New Page
        </Button>
      </div>

      <ul className="divide-y rounded-md border">
        {data.pages.map((page) => (
          <li key={page.id} className="flex items-center justify-between p-4">
            <div>
              <Link href={`/dashboard/pages/${page.id}`} className="font-medium hover:underline">
                {page.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                /{page.slug} · {page._count.versions} versions
                {page.isHomepage && " · Homepage"}
              </p>
            </div>
            <Badge variant={page.status === "PUBLISHED" ? "default" : "secondary"}>
              {page.status}
            </Badge>
          </li>
        ))}
      </ul>

      <div className="flex justify-end gap-2">
        {data.pages.length > 0 && (
          <span className="text-sm text-muted-foreground self-center">Page {sp.page ?? 1} of {data.totalPages}</span>
        )}
      </div>
    </div>
  );
}