import { FileClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { prisma } from "@/server/db/prisma";
import { requireSuperAdmin } from "@/server/authz";

export const instant = false;

export default async function PublishingPage() {
  await requireSuperAdmin();
  const requests = await prisma.publicationRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      page: { select: { id: true, title: true, slug: true, website: { select: { name: true } } } },
      requestedBy: { select: { name: true, email: true } },
      publication: { select: { version: true, status: true } },
    },
  });

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={FileClock}
        title="No publishing requests"
        description="Page publication requests will appear here when submitted."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Publishing requests</h1>
        <p className="text-muted-foreground">Review publication requests across the platform.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Requests ({requests.length})</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">{request.page.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {request.page.website.name} · /{request.page.slug} · Publication v{request.publication.version}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {request.requestedBy.name || request.requestedBy.email} ·{" "}
                    {request.createdAt.toLocaleString()}
                  </p>
                  {request.comment && <p className="mt-1 text-sm">{request.comment}</p>}
                </div>
                <Badge variant={request.status === "PUBLISHED" ? "default" : "secondary"}>{request.status}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Showing up to 100 most recent requests. Request decisions are not available in this read-only view.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
