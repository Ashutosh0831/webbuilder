import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCustomerById } from "@/server/services/customer";

function formatBytes(bytes: bigint) {
  if (bytes < BigInt(1024)) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let value = Number(bytes);
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <p className="text-muted-foreground">{customer.company || customer.contactEmail}</p>
        </div>
        <Button variant="outline" render={<Link href="/admin/customers" />}>
          All customers
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Status:</strong> <Badge variant={customer.status === "ACTIVE" ? "default" : "secondary"}>{customer.status}</Badge></p>
            <p><strong>Contact:</strong> {customer.contactEmail}</p>
            <p><strong>Plan:</strong> {customer.plan}</p>
            <p><strong>Websites:</strong> {customer.websites.length} / {customer.websiteQuota}</p>
            <p><strong>Storage:</strong> {formatBytes(customer.storageUsed)} / {formatBytes(customer.storageQuota)}</p>
            <p><strong>Created:</strong> {customer.createdAt.toLocaleDateString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Customer users ({customer.users.length})</CardTitle></CardHeader>
          <CardContent>
            {customer.users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users are assigned to this customer.</p>
            ) : (
              <ul className="divide-y">
                {customer.users.map((user) => (
                  <li key={user.id} className="py-3">
                    <p className="font-medium">{user.name || user.email}</p>
                    <p className="text-sm text-muted-foreground">{user.email} · {user.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Websites ({customer.websites.length})</CardTitle></CardHeader>
        <CardContent>
          {customer.websites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No websites belong to this customer.</p>
          ) : (
            <ul className="divide-y">
              {customer.websites.map((website) => (
                <li key={website.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link className="font-medium hover:underline" href={`/admin/websites/${website.id}`}>
                      {website.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{website.slug}</p>
                  </div>
                  <Badge variant={website.status === "ACTIVE" ? "default" : "secondary"}>{website.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
