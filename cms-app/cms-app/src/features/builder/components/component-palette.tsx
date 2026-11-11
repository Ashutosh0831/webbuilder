"use client";

import { componentRegistry } from "@/features/components/registry";
import { useBuilderStore } from "../store";
import { Button } from "@/components/ui/button";

const categories = ["content", "layout", "media", "marketing", "navigation"] as const;

export function ComponentPalette() {
  const addSection = useBuilderStore((s) => s.addSection);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold">Components</h3>
      {categories.map((cat) => {
        const items = Object.values(componentRegistry).filter((d) => d.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-xs text-muted-foreground uppercase mb-2">{cat}</p>
            <div className="space-y-1">
              {items.map((def) => (
                <Button
                  key={def.key}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => addSection(def.key)}
                >
                  {def.displayName}
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}