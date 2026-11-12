import { getDashboardMetrics, getRecentActivity, getRecentWebsites } from "@/server/queries/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, CheckCircle, Users, UserCircle, FileClock } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const [metrics, activity, recentWebsites] = await Promise.all([
    getDashboardMetrics(),
    getRecentActivity(),
    getRecentWebsites(),
  ]);

  const statCards = [
    { title: "Total Websites", value: metrics.totalWebsites, icon: Globe, href: "/admin/websites" },
    { title: "Active Websites", value: metrics.activeWebsites, icon: CheckCircle, href: "/admin/websites?status=ACTIVE" },
    { title: "Customers", value: metrics.totalCustomers, icon: Users, href: "/admin/customers" },
    { title: "Active Users", value: metrics.totalUsers, icon: UserCircle, href: "/admin/users" },
    { title: "Pending Requests", value: metrics.pendingPublishRequests, icon: FileClock, href: "/admin/publishing" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform-wide overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recently Created Websites</CardTitle>
          </CardHeader>
          <CardContent>
            {recentWebsites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No websites yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentWebsites.map((w) => (
                  <li key={w.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{w.name}</span>
                      <span className="ml-2 text-muted-foreground">
                        {w.customer.name} · {w._count.pages} pages
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {w.createdAt.toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((log) => (
                  <li key={log.id} className="text-sm">
                    <span className="font-medium">{log.actor?.name ?? "System"}</span>
                    <span className="text-muted-foreground"> {log.action} </span>
                    <span className="text-muted-foreground">on {log.resource}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}