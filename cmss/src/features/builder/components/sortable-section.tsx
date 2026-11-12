"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useBuilderStore } from "../store";
import { getComponentDefinition } from "@/features/components/registry";
import { Button } from "@/components/ui/button";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import type { BuilderSection } from "../types";
import { resolveProps } from "../resolve";
import type { Breakpoint } from "../types";

interface Props {
  section: BuilderSection;
  isSelected: boolean;
}

export function SortableSection({ section, isSelected }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const { selectSection, removeSection, duplicateSection, selectedId, device } = useBuilderStore();
  const breakpoint: Breakpoint = device === "desktop" ? "desktop" : device === "tablet" ? "tablet" : "mobile";
  const resolved = resolveProps(section, breakpoint);
  const def = getComponentDefinition(section.componentKey);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!def) {
    return (
      <div ref={setNodeRef} style={style} className="rounded border border-destructive bg-destructive/5 p-4 text-sm">
        Unknown component: {section.componentKey}
      </div>
    );
  }

  const Rendered = def.render as unknown as React.ComponentType<{ props: unknown; children?: React.ReactNode }>;
  const parsed = def.propsSchema.safeParse(resolved);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); selectSection(section.id); }}
      className={`group relative rounded-lg border-2 bg-background p-1 transition ${
        isSelected ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
      }`}
    >
      <div className="absolute -left-3 top-2 opacity-0 group-hover:opacity-100 transition">
        <button {...attributes} {...listeners} className="cursor-grab p-1 rounded bg-background border">
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute -right-2 top-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
        <Button size="icon" variant="outline" onClick={(e) => { e.stopPropagation(); duplicateSection(section.id); }}>
          <Copy className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="destructive" onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {parsed.success ? (
        <Rendered props={parsed.data}>
          {section.children?.map((child) => (
            <SortableSection key={child.id} section={child} isSelected={selectedId === child.id} />
          ))}
        </Rendered>
      ) : (
        <div className="p-4 text-sm text-destructive">
          Invalid props for {def.displayName}. Fix in the properties panel.
        </div>
      )}
    </div>
  );
}