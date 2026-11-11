"use client";

import { useDroppable } from "@dnd-kit/core";
import { useBuilderStore } from "../store";
import { SortableSection } from "./sortable-section";

export function Canvas() {
  const { sections, selectedId, device } = useBuilderStore();
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-root" });

  const deviceWidth = device === "mobile" ? "max-w-sm" : device === "tablet" ? "max-w-2xl" : "max-w-full";

  if (sections.length === 0) {
    return (
      <div
        ref={setNodeRef}
        className={`mx-auto rounded-lg border-2 border-dashed p-12 text-center ${deviceWidth} ${
          isOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
        }`}
      >
        <p className="text-muted-foreground">Drag a component here or click one in the left panel to start.</p>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} className={`mx-auto space-y-2 ${deviceWidth}`}>
      {sections.map((section) => (
        <SortableSection key={section.id} section={section} isSelected={selectedId === section.id} />
      ))}
    </div>
  );
}