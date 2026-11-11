import { z } from "zod";
import type { ComponentDefinition } from "../types";

const schema = z.object({ size: z.enum(["sm", "md", "lg", "xl"]).default("md") });
type Props = z.infer<typeof schema>;
const map = { sm: "h-4", md: "h-8", lg: "h-16", xl: "h-24" };

export const spacerComponent: ComponentDefinition<Props> = {
  key: "spacer",
  displayName: "Spacer",
  description: "Vertical whitespace",
  category: "layout",
  icon: "Space",
  propsSchema: schema,
  defaultProps: { size: "md" },
  allowedChildren: [],
  render: ({ props }) => <div className={map[props.size]} aria-hidden="true" />,
};