"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { restorePageVersionAction } from "@/server/actions/page";
import { comparePageVersionsAction } from "@/server/actions/versioning";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PageRevision = {
  id: string;
  version: number;
  content: unknown;
  snapshot: unknown;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  changeNote: string | null;
  author: { id: string; name: string | null; email: string };
};

function revisionPayload(revision: PageRevision) {
  return { page: revision.snapshot ?? { note: "Metadata snapshot unavailable for this legacy revision" }, content: revision.content };
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function PageVersionHistory({
  pageId,
  websiteId,
  currentVersion,
  versions,
  publishedVersionId,
}: {
  pageId: string;
  websiteId: string;
  currentVersion: number;
  versions: PageRevision[];
  publishedVersionId: string | null;
}) {
  const router = useRouter();
  const [comparison, setComparison] = useState<[string, string]>([
    versions[0]?.id ?? "",
    versions[1]?.id ?? versions[0]?.id ?? "",
  ]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<{
    versionA: { version: number; content: unknown; createdAt: Date };
    versionB: { version: number; content: unknown; createdAt: Date };
  } | null>(null);

  const before = comparisonResult ? comparisonResult.versionA.content : null;
  const after = comparisonResult ? comparisonResult.versionB.content : null;
  const beforeRecord = before && typeof before === "object" ? before as Record<string, unknown> : {};
  const afterRecord = after && typeof after === "object" ? after as Record<string, unknown> : {};
  const changedFields = comparisonResult
    ? [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])].filter((key) =>
        pretty(beforeRecord[key]) !== pretty(afterRecord[key])
      )
    : [];

  async function compare() {
    setIsComparing(true);
    try {
      const result = await comparePageVersionsAction({
        versionAId: comparison[0],
        versionBId: comparison[1],
        websiteId,
      });
      if ("error" in result) {
        setComparisonResult(null);
        toast.error(result.error);
      } else {
        setComparisonResult(result.comparison);
      }
    } catch (error) {
      setComparisonResult(null);
      toast.error(error instanceof Error ? error.message : "Failed to compare page revisions");
    } finally {
      setIsComparing(false);
    }
  }

  async function restore(revision: PageRevision) {
    if (!window.confirm(`Restore version ${revision.version} as a new draft revision? The published version will remain unchanged.`)) {
      return;
    }

    setRestoringId(revision.id);
    try {
      const result = await restorePageVersionAction({
        pageId,
        versionId: revision.id,
        websiteId,
        expectedVersion: currentVersion,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Restored as a new draft from version ${revision.version}`);
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore revision");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Version history</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No revisions have been saved.</p>
        ) : (
          <ul className="divide-y">
            {versions.map((revision) => (
              <li key={revision.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    Version {revision.version}
                    {revision.id === publishedVersionId && " · Current published"}
                    {revision.isPublished && revision.id !== publishedVersionId && " · Previously published"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {revision.author.name || revision.author.email} · {new Date(revision.createdAt).toLocaleString()}
                    {revision.publishedAt && ` · Published ${new Date(revision.publishedAt).toLocaleString()}`}
                  </p>
                  {revision.changeNote && <p className="mt-1 text-sm">{revision.changeNote}</p>}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm">View revision details</summary>
                    <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
                      {pretty(revisionPayload(revision))}
                    </pre>
                  </details>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restore(revision)}
                  disabled={restoringId !== null}
                >
                  {restoringId === revision.id ? "Restoring..." : "Restore as draft"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {versions.length > 1 && (
          <section className="space-y-3 border-t pt-4">
            <h3 className="font-medium">Compare revisions</h3>
            <div className="flex flex-wrap gap-3">
              {comparison.map((selectedId, index) => (
                <label key={index} className="flex items-center gap-2 text-sm">
                  {index === 0 ? "Older" : "Newer"}
                  <select
                    className="rounded border bg-background px-2 py-1"
                    value={selectedId}
                    onChange={(event) => {
                      setComparison((current) =>
                        current.map((id, itemIndex) => itemIndex === index ? event.target.value : id) as [string, string]
                      );
                      setComparisonResult(null);
                    }}
                  >
                    {versions.map((revision) => (
                      <option key={revision.id} value={revision.id}>Version {revision.version}</option>
                    ))}
                  </select>
                </label>
              ))}
              <Button onClick={compare} disabled={isComparing || !comparison[0] || !comparison[1]}>
                {isComparing ? "Comparing..." : "Compare"}
              </Button>
            </div>
            {comparisonResult && (
              <ul className="space-y-3">
                {changedFields.length === 0 ? (
                  <li className="text-sm text-muted-foreground">The selected revisions are identical.</li>
                ) : changedFields.map((field) => (
                  <li key={field} className="grid gap-2 md:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{field} · Version {comparisonResult.versionA.version}</p>
                      <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{pretty(beforeRecord[field])}</pre>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{field} · Version {comparisonResult.versionB.version}</p>
                      <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{pretty(afterRecord[field])}</pre>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
