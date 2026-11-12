import { UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/server/db/prisma";
import { requireSuperAdmin } from "@/server/authz";

export const instant = false;

export default async function AdminUsersPage() {
  await requireSuperAdmin();
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
      lastLoginAt: true,
      customer: { select: { name: true } },
    },
  });

  if (users.length === 0) {
    return <EmptyState icon={UserCircle} title="No users found" description="Platform users will appear here." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Platform accounts and access status.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Users ({users.length})</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name || user.email}</p>
                  <p className="break-all text-sm text-muted-foreground">
                    {user.email} · {user.customer?.name ?? "Platform account"} · {user.role}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.emailVerified ? "Email verified" : "Email not verified"} · Last login:{" "}
                    {user.lastLoginAt?.toLocaleString() ?? "Never"}
                  </p>
                </div>
                <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>{user.status}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">Showing up to 100 most recently created accounts.</p>
        </CardContent>
      </Card>
    </div>
  );
}
