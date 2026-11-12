import { z } from "zod";
import type { ComponentDefinition } from "../types";

const schema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().max(500),
  href: z.string().optional(),
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
};