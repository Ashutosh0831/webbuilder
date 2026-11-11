import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/server/authz";
import { getWebsiteById } from "@/server/services/website";
import { NewPageForm } from "./new-page-form";

export const instant = false;

export default async function NewPagePage({
  params,
}: {
  params: Promise<{ websiteId: string }>;
}) {
  const { websiteId } = await params;
  const user = await requireAuth();
  const website = await getWebsiteById(websiteId, user.id, user.role ?? "");

  if (!website) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create a page</h1>
        <p className="text-muted-foreground">Add a draft page to {website.name}.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Page details</CardTitle>
          <CardDescription>A unique slug is required within this website.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewPageForm websiteId={website.id} />
        </CardContent>
      </Card>
    </div>
  );
}
