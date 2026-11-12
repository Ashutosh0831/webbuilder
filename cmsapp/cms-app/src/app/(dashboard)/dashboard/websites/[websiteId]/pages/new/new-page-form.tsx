"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPageAction } from "@/server/actions/page";

export function NewPageForm({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    try {
      const result = await createPageAction(formData);
      if (!result.success) {
        toast.error(result.error ?? "Unable to create page.");
        return;
      }
      toast.success("Page created.");
      router.push(`/dashboard/pages/${result.pageId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create page.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="websiteId" value={websiteId} />
      <div className="space-y-2">
        <Label htmlFor="page-title">Title</Label>
        <Input id="page-title" name="title" required maxLength={200} autoComplete="off" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="page-slug">URL slug</Label>
        <Input
          id="page-slug"
          name="slug"
          required
          maxLength={80}
          pattern="[a-z0-9-]+(/[a-z0-9-]+)*"
          title="Use lowercase letters, numbers, and hyphens; separate path segments with slashes."
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Use lowercase letters, numbers, and hyphens. Slugs such as home, 404, and 500 are reserved.
        </p>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create draft page"}
      </Button>
    </form>
  );
}
