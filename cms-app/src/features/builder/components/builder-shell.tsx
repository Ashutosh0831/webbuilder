"use client";

import { useEffect } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useBuilderStore } from "../store";
import { BuilderToolbar } from "./builder-toolbar";
import { ComponentPalette } from "./component-palette";
import { Canvas } from "./canvas";
import { PropertiesPanel } from "./properties-panel";
import type { BuilderSection } from "../types";

export function BuilderShell({
  initial,
}: {
  initial?: {
    websiteId: string;
    pageId: string;
    pageTitle: string;
    version: number;
    sections: BuilderSection[];
  };
}) {
  const { sections, reorderSections } = useBuilderStore();

  useEffect(() => {
    if (!initial) return;
    useBuilderStore.setState({
      ...initial,
      selectedId: null,
      device: "desktop",
      saveStatus: "idle",
      lastSavedAt: null,
      autosaveTimer: null,
    });
  }, [initial]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderSections(String(active.id), String(over.id));
  }

  return (
    <div className="flex h-screen flex-col">
      <BuilderToolbar />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r overflow-y-auto">
          <ComponentPalette />
        </aside>

        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <Canvas />
            </SortableContext>
          </DndContext>
        </main>

        <aside className="w-80 border-l overflow-y-auto">
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}