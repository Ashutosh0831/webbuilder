import { Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperAdmin } from "@/server/authz";

export const instant = false;

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const settings = [
    ["Environment", process.env.NODE_ENV || "Not specified"],
    ["Database connection string variable", process.env.DATABASE_URL ? "Set" : "Not set"],
    ["Authentication", "Better Auth"],
    ["Database", "PostgreSQL via Prisma"],
    ["Application architecture", "Next.js App Router modular monolith"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform settings</h1>
        <p className="text-muted-foreground">Review the application configuration available to this CMS.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration overview
          </CardTitle>
          <CardDescription>Secrets and connection strings are never displayed here.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {settings.map(([label, value]) => (
              <div key={label} className="grid gap-1 py-3 sm:grid-cols-[minmax(12rem,1fr)_2fr]">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="break-words text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Runtime configuration is managed through the deployment environment; this screen is read-only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
