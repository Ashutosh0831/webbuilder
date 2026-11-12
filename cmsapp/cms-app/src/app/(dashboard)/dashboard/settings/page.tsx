import { UserCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/server/db/prisma";
import { requireAuth } from "@/server/authz";

export const instant = false;

export default async function SettingsPage() {
  const sessionUser = await requireAuth();
  const user = await prisma.user.findFirst({
    where: { id: sessionUser.id, deletedAt: null },
    select: {
      name: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
      mfaEnabled: true,
      createdAt: true,
      customer: { select: { name: true } },
    },
  });

  if (!user) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Your account is unavailable. Please sign in again.</p>
      </div>
    );
  }

  const details = [
    ["Name", user.name || "Not set"],
    ["Email", user.email],
    ["Role", user.role],
    ["Account status", user.status],
    ["Email verified", user.emailVerified ? "Yes" : "No"],
    ["Multi-factor authentication", user.mfaEnabled ? "Enabled" : "Not enabled"],
    ["Customer", user.customer?.name ?? "Platform account"],
    ["Member since", user.createdAt.toLocaleDateString()],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Review your account and security status.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>Account details are managed by your platform administrator.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {details.map(([label, value]) => (
              <div key={label} className="grid gap-1 py-3 sm:grid-cols-[minmax(12rem,1fr)_2fr]">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="break-words text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
