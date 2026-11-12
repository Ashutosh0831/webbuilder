import { z } from "zod";
import type { ComponentDefinition } from "../types";

const schema = z.object({
  items: z.array(z.object({
    quote: z.string().min(1).max(500),
    author: z.string().min(1).max(80),
    role: z.string().max(80).optional(),
  })).min(1).max(10),
});

type Props = z.infer<typeof schema>;

export const testimonialsComponent: ComponentDefinition<Props> = {
  key: "testimonials",
  displayName: "Testimonials",
  description: "Quotes with author attribution",
  category: "marketing",
  icon: "Quote",
  propsSchema: schema,
  defaultProps: {
    items: [{ quote: "This product changed everything.", author: "Jane Doe", role: "CEO" }],
  },
  allowedChildren: [],
  render: ({ props }) => (
    <div className="grid gap-6 md:grid-cols-2">
      {props.items.map((item, i) => (
        <blockquote key={i} className="rounded-lg border p-6">
          <p className="italic">&ldquo;{item.quote}&rdquo;</p>
          <footer className="mt-4 text-sm">
            <strong>{item.author}</strong>
            {item.role && <span className="text-muted-foreground"> — {item.role}</span>}
          </footer>
        </blockquote>
      ))}
    </div>
  ),
  editorFields: [
    { key: "items", label: "Testimonials (JSON)", control: { type: "json", rows: 10 }, group: "content" },
  ],
};