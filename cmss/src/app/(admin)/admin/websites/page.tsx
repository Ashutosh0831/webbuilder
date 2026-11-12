import Link from "next/link";
import { getWebsites } from "@/server/services/website";
import { requireAuth } from "@/server/authz";
import { websiteFilterSchema } from "@/lib/validations/website";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Globe } from "lucide-react";

export const instant = false;

export default async function WebsitesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filter = websiteFilterSchema.parse(params);
  const user = await requireAuth();
  const { websites, totalPages } = await getWebsites(filter, user.id, user.role ?? "");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Websites</h1>
        <Button nativeButton={false} render={<Link href="/admin/websites/new" />}>Create Website</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>All Websites ({websites.length})</CardTitle></CardHeader>
        <CardContent>
          {websites.length === 0 ? (
            <EmptyState icon={Globe} title="No websites" description="Create the first website." />
          ) : (
            <ul className="divide-y">
              {websites.map((w) => (
                <li key={w.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link href={`/admin/websites/${w.id}`} className="font-medium hover:underline">
                      {w.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {w.customer.name} · {w.slug} · {w.status} · {w._count.pages} pages · {w._count.members} members
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && <div className="flex justify-end gap-2">
        {filter.page > 1 && (
          <Button nativeButton={false} render={<Link href={`?page=${filter.page - 1}`} />} variant="outline" size="sm">Previous</Button>
        )}
        <span className="text-sm text-muted-foreground self-center">Page {filter.page} of {totalPages}</span>
        {filter.page < totalPages && (
          <Button nativeButton={false} render={<Link href={`?page=${filter.page + 1}`} />} variant="outline" size="sm">Next</Button>
        )}
      </div>}
    </div>
  );
}