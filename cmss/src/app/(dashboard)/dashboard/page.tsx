import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Globe, FileText, Image, Users } from "lucide-react";
import Link from "next/link";
import { requireAuth } from "@/server/authz";
import { getWorkspaceDashboard } from "@/server/queries/dashboard";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const user = await requireAuth();
  const data = await getWorkspaceDashboard(user.id, user.role ?? "");
  const stats = [
    { title: "Websites", value: data.websites, icon: Globe, href: "/dashboard/websites" },
    { title: "Pages", value: data.pages, icon: FileText, href: "/dashboard/pages" },
    { title: "Media Files", value: data.media, icon: Image, href: "/dashboard/media" },
    { title: "Team Members", value: data.teamMembers, icon: Users, href: "/dashboard/websites" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your CMS workspace.
          </p>
        </div>
        {user.role === "super_admin" && (
          <Button nativeButton={false} render={<Link href="/admin/websites/new" />}>Create Website</Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Your latest recorded CMS actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity to display.</p>
          ) : (
            <ul className="divide-y">
              {data.activity.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{item.action}</p>
                    <p className="text-sm text-muted-foreground">{item.resource}</p>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={item.createdAt.toISOString()}>
                    {item.createdAt.toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}