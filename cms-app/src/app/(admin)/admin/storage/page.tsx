import { HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/server/db/prisma";
import { requireSuperAdmin } from "@/server/authz";

export const instant = false;

function formatBytes(bytes: bigint) {
  if (bytes < BigInt(1024)) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB", "PB", "EB"];
  let value = Number(bytes);
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export default async function StoragePage() {
  await requireSuperAdmin();
  const [customers, customerCount, totals] = await Promise.all([
    prisma.customer.findMany({
      where: { deletedAt: null },
      orderBy: { storageUsed: "desc" },
      take: 100,
      select: { id: true, name: true, contactEmail: true, storageUsed: true, storageQuota: true },
    }),
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.customer.aggregate({
      where: { deletedAt: null },
      _sum: { storageUsed: true, storageQuota: true },
    }),
  ]);

  if (customers.length === 0) {
    return <EmptyState icon={HardDrive} title="No customer storage" description="Storage usage will appear when customers are added." />;
  }

  const totalUsed = totals._sum.storageUsed ?? BigInt(0);
  const totalQuota = totals._sum.storageQuota ?? BigInt(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Storage</h1>
        <p className="text-muted-foreground">Customer storage usage and configured quotas.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Storage used</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatBytes(totalUsed)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Combined quota</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatBytes(totalQuota)}</p></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>By customer ({customerCount})</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {customers.map((customer) => (
              <li key={customer.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">{customer.contactEmail}</p>
                </div>
                <p className="text-sm">
                  <span className="font-medium">{formatBytes(customer.storageUsed)}</span>
                  <span className="text-muted-foreground"> / {formatBytes(customer.storageQuota)}</span>
                </p>
              </li>
            ))}
          </ul>
          {customerCount > customers.length && (
            <p className="mt-4 text-xs text-muted-foreground">
              Showing the 100 highest-usage customers. Totals above include all {customerCount} customers.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
