import { z } from "zod";
import type { ComponentDefinition } from "../types";

const schema = z.object({
  items: z.array(z.object({
    icon: z.string().optional(),
    title: z.string().min(1).max(80),
    description: z.string().max(200),
  })).min(1).max(12),
});

type Props = z.infer<typeof schema>;

export const featureGridComponent: ComponentDefinition<Props> = {
  key: "feature-grid",
  displayName: "Feature Grid",
  description: "Grid of feature items",
  category: "marketing",
  icon: "Grid3x3",
  propsSchema: schema,
  defaultProps: {
    items: [
      { title: "Fast", description: "Lightning-quick performance." },
      { title: "Secure", description: "Enterprise-grade security." },
    ],
  },
  allowedChildren: [],
  render: ({ props }) => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {props.items.map((item, i) => (
        <div key={i} className="rounded-lg border p-6">
          <h3 className="font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
        </div>
      ))}
    </div>
  ),
  editorFields: [
    { key: "items", label: "Features (JSON)", control: { type: "json", rows: 10 }, group: "content" },
  ],
};