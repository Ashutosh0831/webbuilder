import { z } from "zod";
import type { ComponentDefinition } from "../types";
import { safeLinkSchema } from "../schemas";

const schema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().max(500),
  href: safeLinkSchema.optional(),
});

type Props = z.infer<typeof schema>;

export const cardComponent: ComponentDefinition<Props> = {
  key: "card",
  displayName: "Card",
  description: "Boxed content with title and body",
  category: "content",
  icon: "Square",
  propsSchema: schema,
  defaultProps: { title: "Card title", body: "Card body content." },
  allowedChildren: [],
  render: ({ props }) => {
    const content = (
      <div className="rounded-lg border p-6 shadow-sm">
        <h3 className="text-lg font-semibold">{props.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{props.body}</p>
      </div>
    );
    return props.href ? <a href={props.href}>{content}</a> : content;
  },
  editorFields: [
    { key: "title", label: "Title", control: { type: "text", maxLength: 100 }, group: "content" },
    { key: "body", label: "Body", control: { type: "textarea", rows: 4 }, group: "content" },
    { key: "href", label: "Link (optional)", control: { type: "url", allowRelative: true }, group: "content" },
  ],
};