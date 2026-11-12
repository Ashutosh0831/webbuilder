import { FileClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ReviewPanel } from "@/components/review-panel";
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
  const pendingRequests = requests.filter((request) => request.status === "PENDING");
  const reviewedRequests = requests.filter((request) => request.status !== "PENDING");

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
        <CardHeader><CardTitle>Pending requests ({pendingRequests.length})</CardTitle></CardHeader>
        <CardContent>
          {pendingRequests.length > 0 ? (
            <ReviewPanel requests={pendingRequests} />
          ) : (
            <p className="text-sm text-muted-foreground">There are no requests awaiting review.</p>
          )}
        </CardContent>
      </Card>
      {reviewedRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recently reviewed requests</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {reviewedRequests.map((request) => (
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
                  </div>
                  <Badge variant={request.status === "PUBLISHED" ? "default" : "secondary"}>{request.status}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Showing up to 100 of the most recent requests.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
