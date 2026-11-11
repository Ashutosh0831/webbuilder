"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ThemePreview } from "./theme-preview";
import { createThemeAction } from "@/server/actions/theme";
import type { ThemeTokens } from "@/lib/validations/themes";

export function ThemeEditor({ websiteId, initial }: { websiteId: string; initial: ThemeTokens }) {
  const [tokens, setTokens] = useState<ThemeTokens>(initial);
  const [saving, setSaving] = useState(false);

  function setNested(path: string, value: string) {
    const [group, key] = path.split(".");
    if (group === "colors") {
      setTokens((current) => ({
        ...current,
        colors: { ...current.colors, [key]: value },
      }));
    } else if (group === "typography") {
      setTokens((current) => ({
        ...current,
        typography: { ...current.typography, [key]: value },
      }));
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await createThemeAction(websiteId, "Custom Theme", tokens);
      toast.success("Theme saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save theme");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-[400px_1fr] gap-6">
      <div className="space-y-4 overflow-y-auto max-h-[80vh]">
        <section>
          <h3 className="font-semibold mb-2">Colors</h3>
          {Object.entries(tokens.colors).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 mb-1">
              <Label className="w-40 text-xs">{key}</Label>
              <input type="color" value={value.startsWith("#") ? value : "#000000"}
                onChange={(e) => setNested(`colors.${key}`, e.target.value)} className="h-7 w-12" />
              <Input value={value} onChange={(e) => setNested(`colors.${key}`, e.target.value)} className="h-7" />
            </div>
          ))}
        </section>

        <section>
          <h3 className="font-semibold mb-2">Typography</h3>
          {Object.entries(tokens.typography).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 mb-1">
              <Label className="w-40 text-xs">{key}</Label>
              <Input value={value} onChange={(e) => setNested(`typography.${key}`, e.target.value)} className="h-7" />
            </div>
          ))}
        </section>

        {/* Similar sections for spacing, radius, shadows, buttons, containers */}

        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Theme"}</Button>
      </div>

      <ThemePreview tokens={tokens}>
        <div className="rounded-lg border p-8 bg-[var(--color-background)] text-[var(--color-foreground)]">
          <h1 className="text-[var(--font-size-h1)] font-[var(--font-heading)]">Preview Heading</h1>
          <p className="mt-[var(--spacing-md)]">Body text uses the base font and foreground color.</p>
          <button className="mt-[var(--spacing-lg)] rounded-[var(--button-radius)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)] px-[var(--button-padding-x)] py-[var(--button-padding-y)]">
            Primary Button
          </button>
        </div>
      </ThemePreview>
    </div>
  );
}