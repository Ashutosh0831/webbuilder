"use client";

import { useBuilderStore } from "../store";
import { getComponentDefinition } from "@/features/components/registry";
import { PropertyControl } from "../property-controls";
import { resolveProps, hasOverride } from "../resolve";
import { Badge } from "@/components/ui/badge";
import type { Breakpoint } from "../types";

export function PropertiesPanel() {
  const { sections, selectedId, device, updateSectionPropsForBreakpoint, clearBreakpointOverride } = useBuilderStore();
  const breakpoint: Breakpoint = device === "desktop" ? "desktop" : device === "tablet" ? "tablet" : "mobile";
  const section = sections.find((item) => item.id === selectedId);
  if (!section) return <div className="p-4 text-sm text-muted-foreground">Select a section to edit its properties.</div>;
  const selectedSection = section;
  const definition = getComponentDefinition(selectedSection.componentKey);
  if (!definition) return <div className="p-4 text-sm text-muted-foreground">This section uses an unavailable component.</div>;
  const component = definition;
  const resolved = resolveProps(selectedSection, breakpoint);

  function handleChange(key: string, value: unknown) {
    const next = { ...resolved, [key]: value };
    const result = component.propsSchema.safeParse(next);
    if (!result.success) return;

    if (breakpoint === "mobile") {
      // Base change: only update base props, but only the keys that changed
      // (to avoid accidentally "freezing" inherited values into base)
      updateSectionPropsForBreakpoint(selectedSection.id, "mobile", { ...selectedSection.props, [key]: value });
    } else {
      // Override change: store only this key at this breakpoint
      const existing = selectedSection.responsive?.[breakpoint] ?? {};
      updateSectionPropsForBreakpoint(selectedSection.id, breakpoint, { ...existing, [key]: value });
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
    </div>
  );
}