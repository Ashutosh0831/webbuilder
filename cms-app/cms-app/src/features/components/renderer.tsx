import type { ReactNode } from "react";
import { getComponentDefinition } from "./registry";
import type { StoredSection } from "./types";

interface RenderResult {
  node: ReactNode;
  errors: string[];
}

export function renderSection(section: StoredSection): RenderResult {
  const errors: string[] = [];
  const def = getComponentDefinition(section.componentKey);

  if (!def) {
    // Unknown component key: log + render nothing (never crash the page)
    errors.push(`Unknown component key: ${section.componentKey}`);
    return { node: null, errors };
  }

  // Validate stored props against the schema
  const parsed = def.propsSchema.safeParse(section.props);
  if (!parsed.success) {
    errors.push(
      `Invalid props for ${section.componentKey}: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`
    );
    return { node: null, errors };
  }

  // Recursively render children only if allowed
  let children: ReactNode = null;
  if (section.children && section.children.length > 0) {
    const childResults = section.children
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => {
        if (!def.allowedChildren.includes(c.componentKey)) {
          errors.push(
            `Component "${c.componentKey}" is not allowed inside "${def.key}"`
          );
          return null;
        }
        return renderSection(c).node;
      });
    children = childResults.filter(Boolean);
  }

  // Render the component
  const Rendered = def.render as unknown as React.ComponentType<{
    props: unknown;
    children?: ReactNode;
  }>;
  return { node: <Rendered props={parsed.data}>{children}</Rendered>, errors };
}

export function renderPage(sections: StoredSection[]): { nodes: ReactNode[]; errors: string[] } {
  const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const results = sorted.map(renderSection);
  return {
    nodes: results.map((r) => r.node).filter(Boolean),
    errors: results.flatMap((r) => r.errors),
  };
}