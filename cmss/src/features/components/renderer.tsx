import type { ReactNode } from "react";
import { getComponentDefinition } from "./registry";
import type { StoredSection } from "./types";

interface RenderResult {
  node: ReactNode;
  errors: string[];
}

export function renderSection(section: StoredSection): RenderResult {
  const hasResponsiveOverrides = Boolean(
    section.responsive &&
    ((section.responsive.tablet && Object.keys(section.responsive.tablet).length > 0) ||
      (section.responsive.desktop && Object.keys(section.responsive.desktop).length > 0))
  );

  if (hasResponsiveOverrides) {
    const baseProps = section.props && typeof section.props === "object" && !Array.isArray(section.props)
      ? section.props as Record<string, unknown>
      : {};
    const renderAt = (breakpoint: "mobile" | "tablet" | "desktop") =>
      renderSection({
        ...section,
        props: breakpoint === "mobile"
          ? baseProps
          : { ...baseProps, ...section.responsive?.[breakpoint] },
        responsive: undefined,
      });

    const mobile = renderAt("mobile");
    const tablet = renderAt("tablet");
    const desktop = renderAt("desktop");

    return {
      node: (
        <>
          <div className="block md:hidden">{mobile.node}</div>
          <div className="hidden md:block lg:hidden">{tablet.node}</div>
          <div className="hidden lg:block">{desktop.node}</div>
        </>
      ),
      errors: [...mobile.errors, ...tablet.errors, ...desktop.errors],
    };
  }

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
    const childResults = [...section.children]
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