import { Suspense } from "react";
import { requireSuperAdmin } from "@/server/authz";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";

async function AdminContent({ children }: { children: React.ReactNode }) {
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" role="status">
          Loading admin area...
        </div>
      }
    >
      <AdminContent>{children}</AdminContent>
    </Suspense>
  );
}