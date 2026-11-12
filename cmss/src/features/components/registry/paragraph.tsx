import { z } from "zod";
import { alignmentSchema, spacingSchema } from "../schemas";
import type { ComponentDefinition } from "../types";

const schema = z.object({
  content: z.string().min(1).max(5000),
  align: alignmentSchema,
  spacing: spacingSchema,
});

type Props = z.infer<typeof schema>;

const spacingMap = { none: "", sm: "mb-2", md: "mb-4", lg: "mb-6", xl: "mb-10" };
const alignmentMap = { left: "text-left", center: "text-center", right: "text-right" };

export const paragraphComponent: ComponentDefinition<Props> = {
  key: "paragraph",
  displayName: "Paragraph",
  description: "Plain text block",
  category: "content",
  icon: "Type",
  propsSchema: schema,
  defaultProps: { content: "Write your paragraph here.", align: "left", spacing: "md" },
  allowedChildren: [],
  render: ({ props }) => (
    <p className={`text-base leading-relaxed ${spacingMap[props.spacing]} ${alignmentMap[props.align]}`}>
      {props.content}
    </p>
  ),
  editorFields: [
  { key: "content", label: "Content", control: { type: "textarea", rows: 5 }, group: "content" },
  { key: "align", label: "Alignment", control: { type: "alignment" }, group: "style" },
  { key: "spacing", label: "Spacing", control: { type: "spacing" }, group: "style" },
],
};