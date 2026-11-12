"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { restoreVersionAction } from "@/server/actions/versioning";
import { comparePageVersionsAction } from "@/server/actions/versioning";

interface Version {
  id: string;
  version: number;
  isPublished: boolean;
  createdAt: Date;
  changeNote: string | null;
  author: { name: string | null; email: string };
}

export function VersionHistoryPanel({
  versions,
  pageId,
  websiteId,
}: {
  versions: Version[];
  pageId: string;
  websiteId: string;
}) {
  const router = useRouter();
  const [comparison, setComparison] = useState<[string, string]>([
    versions[1]?.id ?? "",
    versions[0]?.id ?? "",
  ]);
  const [comparisonResult, setComparisonResult] = useState<{
    versionA: { version: number; content: unknown; createdAt: Date };
    versionB: { version: number; content: unknown; createdAt: Date };
  } | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  function pretty(value: unknown) {
    return JSON.stringify(value, null, 2) ?? "undefined";
  }

  async function handleRestore(versionId: string, versionNumber: number) {
    if (!confirm(`Restore version ${versionNumber}? This creates a new draft revision.`)) return;
    setRestoringId(versionId);
    try {
      const result = await restoreVersionAction(versionId, pageId, websiteId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Restored as version ${result.newVersion}. Submit for review to publish.`);
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore revision.");
    } finally {
      setRestoringId(null);
    }
  }

  async function handleCompare() {
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
      toast.error(error instanceof Error ? error.message : "Failed to compare revisions.");
    } finally {
      setIsComparing(false);
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Version History</h3>
      {versions.length === 0 && (
        <p className="text-sm text-muted-foreground">No revisions have been saved.</p>
      )}
      {versions.map((v) => (
        <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm">
          <div>
            <span className="font-medium">v{v.version}</span>
            {v.isPublished && <Badge className="ml-2">Published</Badge>}
            <p className="text-xs text-muted-foreground">
              {v.author.name ?? v.author.email} · {new Date(v.createdAt).toLocaleString()}
            </p>
            {v.changeNote && <p className="text-xs text-muted-foreground italic">{v.changeNote}</p>}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={restoringId !== null}
              onClick={() => handleRestore(v.id, v.version)}
            >
              {restoringId === v.id ? "Restoring..." : "Restore as draft"}
            </Button>
          </div>
        </div>
      ))}
      {versions.length > 1 && (
        <section className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-medium">Compare revisions</h4>
          <div className="flex flex-wrap items-center gap-3">
            {comparison.map((selectedId, index) => (
              <label key={index} className="flex items-center gap-2 text-sm">
                {index === 0 ? "Older" : "Newer"}
                <select
                  className="rounded border bg-background px-2 py-1"
                  value={selectedId}
                  onChange={(event) => {
                    setComparison((current) =>
                      current.map((id, itemIndex) =>
                        itemIndex === index ? event.target.value : id
                      ) as [string, string]
                    );
                    setComparisonResult(null);
                  }}
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      Version {version.version}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <Button
              size="sm"
              onClick={handleCompare}
              disabled={isComparing || !comparison[0] || !comparison[1] || comparison[0] === comparison[1]}
            >
              {isComparing ? "Comparing..." : "Compare"}
            </Button>
          </div>
          {comparisonResult && (() => {
            const before = comparisonResult.versionA.content;
            const after = comparisonResult.versionB.content;
            const beforeRecord = before && typeof before === "object" ? before as Record<string, unknown> : {};
            const afterRecord = after && typeof after === "object" ? after as Record<string, unknown> : {};
            const changedFields = [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])]
              .filter((field) => pretty(beforeRecord[field]) !== pretty(afterRecord[field]));

            return changedFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">The selected revisions are identical.</p>
            ) : (
              <ul className="space-y-3">
                {changedFields.map((field) => (
                  <li key={field} className="grid gap-2 md:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        {field} · Version {comparisonResult.versionA.version}
                      </p>
                      <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                        {pretty(beforeRecord[field])}
                      </pre>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        {field} · Version {comparisonResult.versionB.version}
                      </p>
                      <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                        {pretty(afterRecord[field])}
                      </pre>
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
        </section>
      )}
    </div>
  );
}