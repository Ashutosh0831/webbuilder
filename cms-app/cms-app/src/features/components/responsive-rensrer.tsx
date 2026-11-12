import type { ComponentType, ReactNode } from "react";
import { getComponentDefinition } from "./registry";
import type { BuilderSection } from "@/features/builder/types";

function renderVariant(section: BuilderSection, breakpoint: "mobile" | "tablet" | "desktop") {
  const def = getComponentDefinition(section.componentKey);
  if (!def) return null;
  const props = breakpoint === "mobile"
    ? section.props
    : { ...section.props, ...(section.responsive?.[breakpoint] ?? {}) };
  const parsed = def.propsSchema.safeParse(props);
  if (!parsed.success) return null;
  const Rendered = def.render as ComponentType<{ props: unknown; children?: ReactNode }>;
  return <Rendered props={parsed.data} />;
}

export function ResponsiveSection({ section }: { section: BuilderSection }) {
  return (
    <>
      <div className="block md:hidden">{renderVariant(section, "mobile")}</div>
      <div className="hidden md:block lg:hidden">{renderVariant(section, "tablet")}</div>
      <div className="hidden lg:block">{renderVariant(section, "desktop")}</div>
    </>
  );
}