"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { restoreContentVersionAction } from "@/server/actions/versioning";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ContentRevision = {
  id: string;
  resourceType: "WEBSITE" | "THEME";
  resourceId: string;
  version: number;
  snapshot: unknown;
  changeNote: string | null;
  createdAt: Date;
  author: { id: string; name: string | null; email: string } | null;
};

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function ContentVersionHistory({
  websiteId,
  versions,
  currentVersions,
}: {
  websiteId: string;
  versions: ContentRevision[];
  currentVersions: Record<string, number>;
}) {
  const router = useRouter();
  const [comparison, setComparison] = useState<[string, string]>(() => {
    const first = versions[0];
    const second = versions.find((item) =>
      first !== undefined && item.resourceType === first.resourceType && item.id !== first.id
    );
    return [first?.id ?? "", second?.id ?? first?.id ?? ""];
  });
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const compared = useMemo(() => comparison.map((id) => versions.find((item) => item.id === id)), [comparison, versions]);
  const secondRevisionOptions = versions.filter((item) =>
    item.resourceType === compared[0]?.resourceType
  );

  async function restore(revision: ContentRevision) {
    const expectedVersion = currentVersions[`${revision.resourceType}:${revision.resourceId}`];
    if (expectedVersion === undefined) {
      toast.error("This content is no longer available to restore.");
      return;
    }
    if (!window.confirm(`Restore ${revision.resourceType.toLowerCase()} version ${revision.version} as a new revision?`)) {
      return;
    }

    setRestoringId(revision.id);
    try {
      const result = await restoreContentVersionAction({
        websiteId,
        versionId: revision.id,
        expectedVersion,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Restored as a new revision");
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore content revision");
    } finally {
      setRestoringId(null);
    }
  }

  const before = compared[0]?.snapshot;
  const after = compared[1]?.snapshot;
  const beforeValues = before && typeof before === "object" ? before as Record<string, unknown> : {};
  const afterValues = after && typeof after === "object" ? after as Record<string, unknown> : {};
  const changedFields = [...new Set([...Object.keys(beforeValues), ...Object.keys(afterValues)])]
    .filter((key) => pretty(beforeValues[key]) !== pretty(afterValues[key]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Website and theme revisions</CardTitle></CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No website or theme revisions have been saved.</p>
          ) : (
            <ul className="divide-y">
              {versions.map((revision) => (
                <li key={revision.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{revision.resourceType} · Version {revision.version}</p>
                    <p className="text-xs text-muted-foreground">
                      {revision.author?.name || revision.author?.email || "Legacy revision"} ·{" "}
                      {new Date(revision.createdAt).toLocaleString()}
                    </p>
                    {revision.changeNote && <p className="mt-1 text-sm">{revision.changeNote}</p>}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm">View revision details</summary>
                      <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
                        {pretty(revision.snapshot)}
                      </pre>
                    </details>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => restore(revision)}
                    disabled={restoringId !== null}
                  >
                    {restoringId === revision.id ? "Restoring..." : "Restore as new revision"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {versions.length > 1 && (
        <Card>
          <CardHeader><CardTitle>Compare revisions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {comparison.map((selectedId, index) => (
                <label key={index} className="flex items-center gap-2 text-sm">
                  {index === 0 ? "Revision A" : "Revision B"}
                  <select
                    className="rounded border bg-background px-2 py-1"
                    value={selectedId}
                    onChange={(event) => {
                      const selected = event.target.value;
                      setComparison((current) => {
                        const next = [...current] as [string, string];
                        next[index] = selected;
                        if (index === 0 && !secondRevisionOptions.some((revision) => revision.id === next[1])) {
                          next[1] = secondRevisionOptions[0]?.id ?? selected;
                        }
                        return next;
                      });
                    }}
                  >
                    {(index === 0 ? versions : secondRevisionOptions).map((revision) => (
                      <option key={revision.id} value={revision.id}>
                        {revision.resourceType} v{revision.version} · {new Date(revision.createdAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {compared[0] && compared[1] && (
              <ul className="space-y-3">
                {changedFields.length === 0 ? (
                  <li className="text-sm text-muted-foreground">The selected revisions are identical.</li>
                ) : changedFields.map((field) => (
                  <li key={field} className="grid gap-2 md:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{field} · A</p>
                      <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{pretty(beforeValues[field])}</pre>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{field} · B</p>
                      <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{pretty(afterValues[field])}</pre>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
