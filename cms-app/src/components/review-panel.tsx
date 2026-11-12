"use client";

import { useState } from "react";
import { toast } from "sonner";
import { reviewPublishRequestAction } from "@/server/actions/publishing";
import { Button } from "@/components/ui/button";

type ReviewRequest = {
  id: string;
  comment: string | null;
  page: { title: string };
  requestedBy: { name: string | null; email: string };
};

function ReviewButton({
  requestId,
  decision,
}: {
  requestId: string;
  decision: "approve" | "reject";
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleReview() {
    setIsSubmitting(true);
    try {
      const result = await reviewPublishRequestAction(requestId, decision);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(decision === "approve" ? "Request approved and published" : "Request rejected");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to review publishing request");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button
      variant={decision === "approve" ? "default" : "outline"}
      onClick={handleReview}
      disabled={isSubmitting}
    >
      {isSubmitting ? "Saving..." : decision === "approve" ? "Approve" : "Reject"}
    </Button>
  );
}

export function ApproveButton({ requestId }: { requestId: string }) {
  return <ReviewButton requestId={requestId} decision="approve" />;
}

export function RejectButton({ requestId }: { requestId: string }) {
  return <ReviewButton requestId={requestId} decision="reject" />;
}

export function ReviewPanel({ requests }: { requests: ReviewRequest[] }) {
  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <div key={request.id} className="rounded border p-4">
          <p className="font-medium">Page: {request.page.title}</p>
          <p className="text-sm text-muted-foreground">
            Requested by: {request.requestedBy.name || request.requestedBy.email}
          </p>
          {request.comment && <p className="text-sm">Note: {request.comment}</p>}
          <div className="mt-2 flex gap-2">
            <ApproveButton requestId={request.id} />
            <RejectButton requestId={request.id} />
          </div>
        </div>
      ))}
    </div>
  );
}
