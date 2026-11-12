import Link from "next/link";
import { getCustomers } from "@/server/services/customer";
import { customerFilterSchema } from "@/lib/validations/customer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Users } from "lucide-react";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filter = customerFilterSchema.parse(params);
  const { customers, totalPages } = await getCustomers(filter);

  if (customers.length === 0 && !filter.search) {
    return (
      <EmptyState
        icon={Users}
        title="No customers yet"
        description="Create your first customer to get started."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <Button render={<Link href="/admin/customers/new" />}>
          Create Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Customers ({customers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {customers.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <Link
                    href={`/admin/customers/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {c.contactEmail} · {c._count.websites} websites · {c._count.users} users
                  </p>
                </div>
                <span className="text-xs rounded-full px-2 py-1 bg-muted">
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {filter.page > 1 && (
          <Button render={<Link href={`?page=${filter.page - 1}`} />} variant="outline" size="sm">
            Previous
          </Button>
        )}
        <span className="text-sm text-muted-foreground self-center">
          Page {filter.page} of {totalPages}
        </span>
        {filter.page < totalPages && (
          <Button render={<Link href={`?page=${filter.page + 1}`} />} variant="outline" size="sm">
            Next
          </Button>
        )}
      </div>
    </div>
  );
}