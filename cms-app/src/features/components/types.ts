import type { z } from "zod";
import type { ComponentType, ReactNode } from "react";

export interface ComponentDefinition<TProps = unknown> {
  /** Stable key used in stored content. Must match /^[a-z][a-z0-9-]*$/ */
  key: string;
  displayName: string;
  description: string;
  category: "layout" | "content" | "media" | "marketing" | "navigation";
  icon: string; // Lucide icon name (string only, resolved in UI)
  /** Zod schema for stored props. Validated before render. */
  propsSchema: z.ZodType<TProps>;
  /** Props applied when the component is first inserted. */
  defaultProps: TProps;
  /** Allowed child keys; empty array = leaf component. */
  allowedChildren: string[];
  /** Renderer. Receives already-validated props. */
  render: ComponentType<{ props: TProps; children?: ReactNode }>;
}

export type ComponentRegistry = Record<string, ComponentDefinition>;

/** Validated content section from the database. */
export interface StoredSection {
  id: string;
  componentKey: string;
  props: unknown;
  children?: StoredSection[];
  sortOrder: number;
}

/** Runtime instance passed to renderers. */
export interface RenderedNode {
  definition: ComponentDefinition;
  props: unknown;
  children: React.ReactNode;
}