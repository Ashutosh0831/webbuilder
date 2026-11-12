"use client";

import Image from "next/image";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { EditorControl } from "@/features/components/types";

interface ControlProps {
  fieldKey: string;
  label: string;
  control: EditorControl;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}

export function PropertyControl({ fieldKey, label, control, value, onChange, error }: ControlProps) {
  const id = `prop-${fieldKey}`;
  const serializedValue = control.type === "json"
    ? JSON.stringify(value ?? {}, null, 2)
    : String(value ?? "");
  const [draftState, setDraftState] = useState({
    source: serializedValue,
    value: serializedValue,
  });
  const draft = draftState.source === serializedValue
    ? draftState.value
    : serializedValue;
  const setDraft = (value: string) => {
    setDraftState({ source: serializedValue, value });
  };

  let input: React.ReactNode;

  switch (control.type) {
    case "text":
      input = (
        <Input
          id={id}
          value={draft}
          maxLength={control.maxLength}
          placeholder={control.placeholder}
          onChange={(e) => { setDraft(e.target.value); onChange(e.target.value); }}
        />
      );
      break;

    case "textarea":
      input = (
        <Textarea
          id={id}
          rows={control.rows ?? 4}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); onChange(e.target.value); }}
        />
      );
      break;

    case "json":
      input = (
        <Textarea
          id={id}
          rows={control.rows ?? 8}
          value={draft}
          spellCheck={false}
          className="font-mono text-xs"
          onChange={(e) => {
            setDraft(e.target.value);
            try { onChange(JSON.parse(e.target.value)); } catch { /* retain the draft until it becomes valid JSON */ }
          }}
        />
      );
      break;

    case "number":
      input = (
        <Input
          id={id}
          type="number"
          min={control.min}
          max={control.max}
          step={control.step}
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
      break;

    case "boolean":
      input = (
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4"
        />
      );
      break;

    case "select":
      input = (
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue /></SelectTrigger>
          <SelectContent>
            {control.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;

    case "color":
      input = (
        <div className="flex gap-2">
          <input
            id={id}
            type="color"
            value={String(value ?? "#000000")}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 rounded border"
          />
          <Input
            value={String(value ?? "")}
            onChange={(e) => {
              // Only allow hex, rgb, hsl, or CSS variable references
              const v = e.target.value;
              if (/^(#[0-9a-fA-F]{3,8}|rgb\(|hsl\(|var\(--)/.test(v) || v === "") onChange(v);
            }}
          />
        </div>
      );
      break;

    case "image":
      input = (
        <div className="space-y-2">
          <Input
            id={id}
            type="text"
            placeholder="https://... or /api/media/..."
            value={draft}
            onChange={(e) => { setDraft(e.target.value); onChange(e.target.value); }}
          />
          {typeof value === "string" && value.length > 0 && (
            <Image
              src={value}
              alt="Preview"
              width={320}
              height={80}
              unoptimized
              className="h-20 w-full rounded object-cover"
            />
          )}
        </div>
      );
      break;

    case "url":
      input = (
        <Input
          id={id}
          placeholder={control.allowRelative ? "/path or https://..." : "https://..."}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); onChange(e.target.value); }}
        />
      );
      break;

    case "spacing":
      input = (
        <Select value={String(value ?? "md")} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue /></SelectTrigger>
          <SelectContent>
            {["none", "sm", "md", "lg", "xl"].map((s) => (
              <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;

    case "alignment":
      input = (
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <Button
              key={a}
              type="button"
              size="sm"
              variant={value === a ? "secondary" : "outline"}
              onClick={() => onChange(a)}
            >
              {a[0].toUpperCase() + a.slice(1)}
            </Button>
          ))}
        </div>
      );
      break;

    default:
      input = <p className="text-sm text-muted-foreground">Unsupported control.</p>;
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {input}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}