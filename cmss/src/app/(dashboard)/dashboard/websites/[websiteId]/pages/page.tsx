import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPages } from "@/server/services/page";
import { requireAuth } from "@/server/authz";
import { prisma } from "@/server/db/prisma";
import { pageFilterSchema } from "@/lib/validations/page";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FileText } from "lucide-react";

// 1. The default export just provides the Suspense boundary
export default function PagesPage({ params, searchParams }: { params: Promise<{ websiteId: string }>, searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading pages...</div>}>
      <PagesList params={params} searchParams={searchParams} />
    </Suspense>
  );
}

// 2. The inner component does the data fetching
async function PagesList({ params, searchParams }: { params: Promise<{ websiteId: string }>, searchParams: Promise<Record<string, string | undefined>> }) {
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
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{website.name} — Pages</h1>
          <Link href={`/dashboard/websites/${websiteId}/pages/new`} className={buttonVariants()}>
            New Page
          </Link>
        </div>
        <EmptyState icon={FileText} title="No pages yet" description="Create your first page to get started." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{website.name} — Pages</h1>
          <p className="text-sm text-muted-foreground">{data.total} total</p>
        </div>
        <Link href={`/dashboard/websites/${websiteId}/pages/new`} className={buttonVariants()}>
          New Page
        </Link>
      </div>

      <ul className="divide-y rounded-md border bg-card">
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
    </div>
  );
}