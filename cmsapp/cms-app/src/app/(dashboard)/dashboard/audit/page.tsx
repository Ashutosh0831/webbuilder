import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/authz";

export const instant = false;

export default async function AuditPage() {
  const user = await requireAuth();
  const logs = await prisma.auditLog.findMany({
    where: { actorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, action: true, resource: true, createdAt: true },
  });

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="No activity recorded"
        description="Actions performed by your account will appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit logs</h1>
        <p className="text-muted-foreground">Your recent account activity.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent events ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{log.action}</p>
                  <p className="text-sm text-muted-foreground">{log.resource}</p>
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
