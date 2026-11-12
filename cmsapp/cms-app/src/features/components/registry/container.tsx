import { z } from "zod";
import type { ComponentDefinition } from "../types";

const schema = z.object({
  maxWidth: z.enum(["sm", "md", "lg", "xl", "full"]).default("lg"),
  padding: z.enum(["none", "sm", "md", "lg"]).default("md"),
});

type Props = z.infer<typeof schema>;

const widthMap = { sm: "max-w-xl", md: "max-w-3xl", lg: "max-w-5xl", xl: "max-w-7xl", full: "max-w-none" };
const paddingMap = { none: "", sm: "px-2 py-2", md: "px-4 py-6", lg: "px-6 py-12" };

export const containerComponent: ComponentDefinition<Props> = {
  key: "container",
  displayName: "Container",
  description: "Constrains width and adds padding. Can hold children.",
  category: "layout",
  icon: "Box",
  propsSchema: schema,
  defaultProps: { maxWidth: "lg", padding: "md" },
  allowedChildren: [
    "heading", "paragraph", "image", "button", "columns", "card",
    "hero", "feature-grid", "testimonials", "faq", "spacer", "divider",
  ],
  render: ({ props, children }) => (
    <div className={`mx-auto ${widthMap[props.maxWidth]} ${paddingMap[props.padding]}`}>
      {children}
    </div>
  ) as never,
};