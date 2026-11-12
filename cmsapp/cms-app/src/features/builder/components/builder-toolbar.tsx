"use client";

import { useBuilderStore } from "../store";
import { Button } from "@/components/ui/button";
import { Monitor, Tablet, Smartphone, Save, Eye } from "lucide-react";
import { hasOverride } from "../resolve";
import type { Breakpoint } from "../types";

export function BuilderToolbar() {
  const {
    sections,
    selectedId,
    device,
    setDevice,
    saveStatus,
    pageTitle,
  } = useBuilderStore();
  const selectedSection = sections.find((section) => section.id === selectedId);
  const devices: { breakpoint: Breakpoint; Icon: typeof Monitor }[] = [
    { breakpoint: "desktop", Icon: Monitor },
    { breakpoint: "tablet", Icon: Tablet },
    { breakpoint: "mobile", Icon: Smartphone },
  ];

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-4">
        <span className="font-semibold">{pageTitle || "Untitled Page"}</span>
        <span className="text-xs text-muted-foreground">
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border">
          {devices.map(({ breakpoint, Icon }) => (
            <Button
              key={breakpoint}
              aria-label={breakpoint}
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
        <Button variant="outline" size="sm"><Eye className="mr-2 h-4 w-4" />Preview</Button>
        <Button size="sm"><Save className="mr-2 h-4 w-4" />Save</Button>
      </div>
    </header>
  );
}