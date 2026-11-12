"use client";

import { useBuilderStore } from "../store";
import { getComponentDefinition } from "@/features/components/registry";
import { PropertyControl } from "../property-controls";
import { resolveProps, hasOverride } from "../resolve";
import { Badge } from "@/components/ui/badge";
import type { Breakpoint } from "../types";

export function PropertiesPanel() {
  const { sections, selectedId, device, updateSectionPropsForBreakpoint, clearBreakpointOverride, addChildSection } = useBuilderStore();
  const breakpoint: Breakpoint = device === "desktop" ? "desktop" : device === "tablet" ? "tablet" : "mobile";
  function findSection(items: typeof sections, id: string | null): (typeof sections)[number] | undefined {
    if (!id) return undefined;
    for (const item of items) {
      if (item.id === id) return item;
      const nested = findSection(item.children ?? [], id);
      if (nested) return nested;
    }
    return undefined;
  }
  const section = findSection(sections, selectedId);
  if (!section) return <div className="p-4 text-sm text-muted-foreground">Select a section to edit its properties.</div>;
  const selectedSection = section;
  const definition = getComponentDefinition(selectedSection.componentKey);
  if (!definition) return <div className="p-4 text-sm text-muted-foreground">This section uses an unavailable component.</div>;
  const component = definition;
  const resolved = resolveProps(selectedSection, breakpoint);

  function handleChange(key: string, value: unknown) {
    const currentValue = resolved[key];
    const normalizedValue = typeof currentValue === "number" && typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : value;
    const next = { ...resolved, [key]: normalizedValue };
    const result = component.propsSchema.safeParse(next);
    if (!result.success) return;

    if (breakpoint === "mobile") {
      // Base change: only update base props, but only the keys that changed
      // (to avoid accidentally "freezing" inherited values into base)
      updateSectionPropsForBreakpoint(selectedSection.id, "mobile", { ...selectedSection.props, [key]: normalizedValue });
    } else {
      // Override change: store only this key at this breakpoint
      const existing = selectedSection.responsive?.[breakpoint] ?? {};
      updateSectionPropsForBreakpoint(selectedSection.id, breakpoint, { ...existing, [key]: normalizedValue });
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{component.displayName}</h3>
        {breakpoint !== "mobile" && hasOverride(selectedSection, breakpoint) && (
          <Badge variant="secondary">{breakpoint} override</Badge>
        )}
      </div>

      {breakpoint !== "mobile" && (
        <p className="text-xs text-muted-foreground">
          Changes here apply only on {breakpoint}. <button
            onClick={() => clearBreakpointOverride(selectedSection.id, breakpoint)}
            className="underline"
          >Reset all</button>
        </p>
      )}

      {(selectedSection.componentKey === "image" || selectedSection.componentKey === "hero") && (
        <a href="/dashboard/media" target="_blank" rel="noreferrer" className="block text-xs text-primary underline">
          Open media library to upload or copy an image URL
        </a>
      )}

      {component.editorFields?.map((field) => (
        <PropertyControl
          key={field.key}
          fieldKey={field.key}
          label={field.label}
          control={field.control}
          value={resolved[field.key]}
          onChange={(v) => handleChange(field.key, v)}
        />
      ))}

      {component.allowedChildren.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Nested content</h4>
          <p className="text-xs text-muted-foreground">Add content inside this {component.displayName.toLowerCase()}.</p>
          <div className="grid grid-cols-2 gap-2">
            {component.allowedChildren.map((childKey) => {
              const childDefinition = getComponentDefinition(childKey);
              if (!childDefinition) return null;
              return (
                <button
                  key={childKey}
                  type="button"
                  className="rounded-md border px-2 py-2 text-xs hover:bg-muted"
                  onClick={() => addChildSection(selectedSection.id, childKey)}
                >
                  + {childDefinition.displayName}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{selectedSection.children?.length ?? 0} child item(s)</p>
        </div>
      )}
    </div>
  );
}