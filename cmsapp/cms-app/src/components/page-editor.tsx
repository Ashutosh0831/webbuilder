"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updatePageAction } from "@/server/actions/page";
import { updatePageSchema } from "@/lib/validations/page";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import { PageVersionHistory } from "@/components/page-version-history";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PageEditorProps {
  page: {
    id: string;
    websiteId?: string;
    version?: number;
    title: string;
    slug: string;
    seo: unknown;
    status: string;
    versions: Array<{
      id: string;
      version: number;
      content: unknown;
      snapshot: unknown;
      isPublished: boolean;
      publishedAt: Date | null;
      createdAt: Date;
      changeNote: string | null;
      author: { id: string; name: string | null; email: string };
    }>;
  };
  latestDraftContent: string | null;
  publishedVersionId: string | null;
}

export function PageEditor({ page, latestDraftContent, publishedVersionId }: PageEditorProps) {
  const [saving, setSaving] = useState(false);
  const form = useForm({
    resolver: zodResolver(updatePageSchema),
    defaultValues: { id: page.id, expectedVersion: page.version ?? 0, title: page.title, slug: page.slug },
  });

  async function onSubmit(values: unknown) {
    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(values as Record<string, unknown>).forEach(([k, v]) => formData.set(k, String(v ?? "")));
      const result = await updatePageAction(formData);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        form.setValue("expectedVersion", result.expectedVersion);
        toast.success("Saved");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save page");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Page</h1>
        <p className="text-sm text-muted-foreground">
          Status: {page.status}
          {latestDraftContent ? " · Unpublished draft exists" : " · No pending draft"}
        </p>
      </div>

      {latestDraftContent && page.websiteId && (
        <SubmitForReviewButton pageId={page.id} websiteId={page.websiteId} />
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <input type="hidden" {...form.register("expectedVersion", { valueAsNumber: true })} />
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...form.register("title")} />
        </div>
        <div>
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" {...form.register("slug")} />
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Draft"}</Button>
      </form>

      {page.version !== undefined && page.websiteId && (
        <PageVersionHistory
          pageId={page.id}
          websiteId={page.websiteId}
          currentVersion={page.version}
          versions={page.versions}
          publishedVersionId={publishedVersionId}
        />
      )}
    </div>
  );
}