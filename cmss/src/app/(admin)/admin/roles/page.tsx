import { Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/server/db/prisma";
import { requireSuperAdmin } from "@/server/authz";

export const instant = false;

export default async function AdminRolesPage() {
  await requireSuperAdmin();
  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    take: 100,
    include: {
      permissions: { include: { permission: { select: { code: true, description: true } } } },
      _count: { select: { userRoles: true, websiteMembers: true } },
    },
  });

  if (roles.length === 0) {
    return <EmptyState icon={Shield} title="No roles configured" description="Roles will appear here when they are created." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Roles &amp; permissions</h1>
        <p className="text-muted-foreground">Review access roles and their assigned permissions.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{role.name}</span>
                {role.isSystem && <span className="text-xs font-normal text-muted-foreground">System role</span>}
              </CardTitle>
              <CardDescription>
                {role.description || "No description"} · {role._count.userRoles} user assignments ·{" "}
                {role._count.websiteMembers} website memberships
              </CardDescription>
            </CardHeader>
            <CardContent>
              {role.permissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No permissions assigned.</p>
              ) : (
                <ul className="space-y-2">
                  {role.permissions.map(({ permission }) => (
                    <li key={permission.code} className="text-sm">
                      <code className="rounded bg-muted px-1.5 py-0.5">{permission.code}</code>
                      {permission.description && (
                        <span className="ml-2 text-muted-foreground">{permission.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
