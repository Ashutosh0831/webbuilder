import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/server/db/prisma";
import { requireSuperAdmin } from "@/server/authz";
import { NewWebsiteForm } from "./new-website-form";

export const instant = false;

export default async function NewWebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const customers = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      users: {
        some: {
          role: "website_owner",
          status: "ACTIVE",
          deletedAt: null,
        },
      },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, contactEmail: true, status: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create website</h1>
        <p className="text-muted-foreground">Create a new site for a customer.</p>
      </div>
      {customers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No customers available</CardTitle>
            <CardDescription>Create a customer, open its detail page, and create an active Website Owner login before creating a website.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/admin/customers" />}>Go to customers</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Website details</CardTitle>
            <CardDescription>Choose an owner and configure the public site identity.</CardDescription>
          </CardHeader>
          <CardContent>
            <NewWebsiteForm customers={customers} initialCustomerId={params.customerId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
