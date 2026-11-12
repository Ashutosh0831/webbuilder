"use client";

import { useState } from "react";
import { toast } from "sonner";
import { submitPublishRequestAction } from "@/server/actions/publishing";
import { Button } from "@/components/ui/button";

export function SubmitForReviewButton({
  pageId,
  websiteId,
  disabled = false,
}: {
  pageId: string;
  websiteId: string;
  disabled?: boolean;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const result = await submitPublishRequestAction(pageId, websiteId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Submitted for review");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit publishing request");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button onClick={handleSubmit} disabled={isSubmitting || disabled}>
      {isSubmitting ? "Submitting..." : "Submit for Review"}
    </Button>
  );
}
