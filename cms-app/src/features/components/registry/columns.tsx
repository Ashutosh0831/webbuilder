import { z } from "zod";
import type { ComponentDefinition } from "../types";

const schema = z.object({
  count: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
  gap: z.enum(["sm", "md", "lg"]).default("md"),
});

type Props = z.infer<typeof schema>;

const gapMap = { sm: "gap-2", md: "gap-4", lg: "gap-8" };

export const columnsComponent: ComponentDefinition<Props> = {
  key: "columns",
  displayName: "Columns",
  description: "Multi-column layout. Each child becomes a column.",
  category: "layout",
  icon: "Columns",
  propsSchema: schema,
  defaultProps: { count: 2, gap: "md" },
  allowedChildren: ["heading", "paragraph", "image", "button", "card"],
  render: ({ props, children }) => (
    <div
      className={`grid ${gapMap[props.gap]}`}
      style={{ gridTemplateColumns: `repeat(${props.count}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  ) as never,
};