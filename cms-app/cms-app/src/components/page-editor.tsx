"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updatePageAction } from "@/server/actions/page";
import { updatePageSchema } from "@/lib/validations/page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PageEditorProps {
  page: {
    id: string;
    title: string;
    slug: string;
    seo: unknown;
    status: string;
    versions: Array<{ id: string; version: number; isPublished: boolean; createdAt: Date }>;
  };
  latestDraftContent: string | null;
  publishedVersionId: string | null;
}

export function PageEditor({ page, latestDraftContent, publishedVersionId }: PageEditorProps) {
  const [saving, setSaving] = useState(false);
  const form = useForm({
    resolver: zodResolver(updatePageSchema),
    defaultValues: { id: page.id, title: page.title, slug: page.slug },
  });

  async function onSubmit(values: unknown) {
    setSaving(true);
    const formData = new FormData();
    Object.entries(values as Record<string, unknown>).forEach(([k, v]) => formData.set(k, String(v ?? "")));
    const result = await updatePageAction(formData);
    if (result.error) toast.error(result.error);
    else toast.success("Saved");
    setSaving(false);
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

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
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

      <Card>
        <CardHeader><CardTitle>Version History</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {page.versions.map((v) => (
              <li key={v.id} className="flex justify-between">
                <span>v{v.version} — {new Date(v.createdAt).toLocaleString()}</span>
                <span className="text-muted-foreground">
                  {v.id === publishedVersionId
                    ? "Current published"
                    : v.isPublished
                      ? "Published"
                      : "Draft"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}