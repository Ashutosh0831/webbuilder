// src/features/components/builder-meta.ts
import { componentRegistry } from "./registry";

export function getPaletteItems() {
  return Object.values(componentRegistry).map((d) => ({
    key: d.key,
    displayName: d.displayName,
    description: d.description,
    category: d.category,
    icon: d.icon,
    defaultProps: d.defaultProps,
  }));
}

export function getEditorSchema(key: string) {
  const def = componentRegistry[key];
  if (!def) return null;
  // Return a JSON-schema-compatible representation of the Zod schema
  // for auto-generating property forms
  return {
    key: def.key,
    schema: def.propsSchema,
    defaults: def.defaultProps,
    allowedChildren: def.allowedChildren,
  };
}