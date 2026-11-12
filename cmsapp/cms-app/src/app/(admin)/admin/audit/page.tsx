import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/server/db/prisma";
import { requireSuperAdmin } from "@/server/authz";

export const instant = false;

export default async function AdminAuditPage() {
  await requireSuperAdmin();
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true, email: true } } },
  });

  if (logs.length === 0) {
    return <EmptyState icon={ClipboardList} title="No audit events" description="Platform activity will appear here." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit logs</h1>
        <p className="text-muted-foreground">Recent activity across the platform.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Recent events ({logs.length})</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{log.action}</p>
                  <p className="text-sm text-muted-foreground">
                    {log.actor?.name || log.actor?.email || "System"} · {log.resource}
                  </p>
                </div>
                <time className="text-xs text-muted-foreground" dateTime={log.createdAt.toISOString()}>
                  {log.createdAt.toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Showing up to 100 most recent events.</p>
        </CardContent>
      </Card>
    </div>
  );
}
