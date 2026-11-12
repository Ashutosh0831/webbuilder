import type { Breakpoint, BuilderSection } from "./types";

export function resolveProps(
  section: Pick<BuilderSection, "props" | "responsive">,
  breakpoint: Breakpoint
): Record<string, unknown> {
  if (breakpoint === "mobile") return section.props;
  const override = section.responsive?.[breakpoint];
  if (!override) return section.props;
  return { ...section.props, ...override };
}

export function hasOverride(
  section: Pick<BuilderSection, "responsive">,
  breakpoint: Breakpoint
): boolean {
  if (breakpoint === "mobile") return false;
  const override = section.responsive?.[breakpoint];
  return override !== undefined && Object.keys(override).length > 0;
}