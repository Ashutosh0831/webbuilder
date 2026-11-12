import { z } from "zod";
import type { ComponentDefinition } from "../types";

const schema = z.object({ spacing: z.enum(["sm", "md", "lg"]).default("md") });
type Props = z.infer<typeof schema>;
const map = { sm: "my-2", md: "my-6", lg: "my-10" };

export const dividerComponent: ComponentDefinition<Props> = {
  key: "divider",
  displayName: "Divider",
  description: "Horizontal rule",
  category: "layout",
  icon: "Minus",
  propsSchema: schema,
  defaultProps: { spacing: "md" },
  allowedChildren: [],
  render: ({ props }) => <hr className={`border-t ${map[props.spacing]}`} />,
  editorFields: [
    { key: "spacing", label: "Spacing", control: { type: "select", options: [
      { label: "Small", value: "sm" }, { label: "Medium", value: "md" }, { label: "Large", value: "lg" },
    ] }, group: "style" },
  ],
};