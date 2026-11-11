import { z } from "zod";
import { alignmentSchema, spacingSchema } from "../schemas";
import type { ComponentDefinition } from "../types";

const schema = z.object({
  text: z.string().min(1).max(200),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(2),
  align: alignmentSchema,
  spacing: spacingSchema,
});

type Props = z.infer<typeof schema>;

const spacingMap = { none: "", sm: "mb-2", md: "mb-4", lg: "mb-6", xl: "mb-10" };

export const headingComponent: ComponentDefinition<Props> = {
  key: "heading",
  displayName: "Heading",
  description: "Semantic heading (h1–h4)",
  category: "content",
  icon: "Heading",
  propsSchema: schema,
  defaultProps: { text: "Heading", level: 2, align: "left", spacing: "md" },
  allowedChildren: [],
  render: ({ props }) => {
    const Tag = `h${props.level}` as const;
    return (
      <Tag className={`font-bold ${spacingMap[props.spacing]} text-${props.align}`}>
        {props.text}
      </Tag>
    );
  },
};