import { requireSuperAdmin } from "@/server/authz";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin(); // Server-side enforcement, runs before any child renders

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}