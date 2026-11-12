import { Button } from "@/components/ui/button";
import { LayoutDashboard, Globe, FileText } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold tracking-tight">CMS Platform</h1>
      <p className="text-muted-foreground">
        Modular monolith · Next.js App Router · Prisma · Better Auth
      </p>
      <div className="flex gap-4">
        <Button render={<Link href="/login" />}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Sign in
        </Button>
        <Button variant="outline" render={<Link href="/dashboard" />}>
          <Globe className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
        <Button variant="secondary" render={<Link href="/dashboard/pages" />}>
          <FileText className="mr-2 h-4 w-4" />
          Manage Pages
        </Button>
      </div>
    </main>
  );
}