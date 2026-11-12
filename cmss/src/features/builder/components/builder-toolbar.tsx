"use client";

import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { useBuilderStore, useTemporalStore } from "../store";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone, Save, Eye, Undo2, Redo2 } from "lucide-react";
import { hasOverride, resolveProps } from "../resolve";
import type { Breakpoint, BuilderSection } from "../types";
import { renderPage } from "@/features/components/renderer";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function resolveSectionsForPreview(
  sections: BuilderSection[],
  breakpoint: Breakpoint,
): BuilderSection[] {
  return sections.map((section) => ({
    ...section,
    props: resolveProps(section, breakpoint),
    responsive: undefined,
    children: section.children
      ? resolveSectionsForPreview(section.children, breakpoint)
      : [],
  }));
}

export function BuilderToolbar() {
  const {
    sections,
    selectedId,
    device,
    setDevice,
    saveStatus,
    setSaveStatus,
    pageTitle,
    pageId,
    websiteId,
  } = useBuilderStore();
  const [previewOpen, setPreviewOpen] = useState(false);
  const { undo, redo, pastStates, futureStates } = useStore(useTemporalStore);
  function findSelected(items: BuilderSection[]): BuilderSection | undefined {
    for (const item of items) {
      if (item.id === selectedId) return item;
      const nested = findSelected(item.children ?? []);
      if (nested) return nested;
    }
    return undefined;
  }
  const selectedSection = findSelected(sections);
  const devices: { breakpoint: Breakpoint; Icon: typeof Monitor }[] = [
    { breakpoint: "desktop", Icon: Monitor },
    { breakpoint: "tablet", Icon: Tablet },
    { breakpoint: "mobile", Icon: Smartphone },
  ];

  const preview = useMemo(() => {
    const resolvedSections = resolveSectionsForPreview(sections, device);
    return renderPage(resolvedSections);
  }, [sections, device]);

  const statusLabel = {
    idle: "Unsaved changes",
    saving: "Saving…",
    saved: "All changes saved",
    error: "Save failed — try again",
    conflict: "Save conflict — reload this page",
  }[saveStatus];

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="truncate font-semibold">{pageTitle || "Untitled Page"}</span>
          <span
            className={`text-xs ${saveStatus === "error" || saveStatus === "conflict" ? "text-destructive" : "text-muted-foreground"}`}
            role="status"
            aria-live="polite"
          >
            {statusLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-md border">
            {devices.map(({ breakpoint, Icon }) => (
              <Button
                key={breakpoint}
                aria-label={breakpoint}
                aria-pressed={device === breakpoint}
                variant={device === breakpoint ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setDevice(breakpoint)}
              >
                <Icon className="h-4 w-4" />
                {selectedSection && hasOverride(selectedSection, breakpoint) && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo"
            title="Undo"
            disabled={pastStates.length === 0 || saveStatus === "saving"}
            onClick={() => { undo(); useBuilderStore.getState().scheduleAutosave(); }}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Redo"
            title="Redo"
            disabled={futureStates.length === 0 || saveStatus === "saving"}
            onClick={() => { redo(); useBuilderStore.getState().scheduleAutosave(); }}
          >
            <Redo2 className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>

          <Button
            size="sm"
            onClick={() => setSaveStatus("saving")}
            disabled={saveStatus === "saving" || saveStatus === "conflict"}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveStatus === "saving" ? "Saving…" : "Save"}
          </Button>
          {pageId && websiteId && (
            <SubmitForReviewButton
              pageId={pageId}
              websiteId={websiteId}
              disabled={saveStatus !== "saved"}
            />
          )}
        </div>
      </header>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pageTitle || "Page preview"}</DialogTitle>
            <DialogDescription>
              Draft preview at the {device} breakpoint. This preview does not publish your page.
            </DialogDescription>
          </DialogHeader>

          {preview.errors.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {preview.errors.map((error, index) => (
                <p key={`${index}-${error}`}>{error}</p>
              ))}
            </div>
          )}

          <div className="min-h-48 space-y-4 rounded-md border bg-background p-4">
            {preview.nodes.length > 0 ? (
              preview.nodes
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                This page is empty. Add components from the left panel to preview your design.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
