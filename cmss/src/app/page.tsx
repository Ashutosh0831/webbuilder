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
        <Button nativeButton={false} render={<Link href="/login" />}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Sign in
        </Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/dashboard" />}>
          <Globe className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
        <Button nativeButton={false} variant="secondary" render={<Link href="/dashboard/pages" />}>
          <FileText className="mr-2 h-4 w-4" />
          Manage Pages
        </Button>
      </div>
      <section
        aria-labelledby="equation-title"
        className="w-full max-w-2xl rounded-lg border p-6 text-center"
      >
        <h2 id="equation-title" className="text-lg font-semibold">
          Equation
        </h2>
        <p
          aria-label="The sum from k equals 0 to 9 of 1000 times x to the k equals 5 times 60 times 1000"
          className="mt-4 text-2xl"
        >
          ∑<sub>k=0</sub><sup>9</sup> 1000x<sup>k</sup> = 5 × 60 × 1000
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Equivalent after dividing both sides by 1,000:
        </p>
        <p
          aria-label="The sum from k equals 0 to 9 of x to the k equals 300"
          className="mt-2 text-xl"
        >
          ∑<sub>k=0</sub><sup>9</sup> x<sup>k</sup> = 300
        </p>
      </section>
    </main>
  );
}