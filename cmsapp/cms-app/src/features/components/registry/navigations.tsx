import { z } from "zod";
import type { ComponentDefinition } from "../types";

const schema = z.object({
  items: z.array(z.object({
    label: z.string().min(1).max(40),
    href: z.string().min(1).max(200),
  })).min(1).max(10),
  sticky: z.boolean().default(false),
});

type Props = z.infer<typeof schema>;

export const navigationComponent: ComponentDefinition<Props> = {
  key: "navigation",
  displayName: "Navigation",
  description: "Site header links",
  category: "navigation",
  icon: "Menu",
  propsSchema: schema,
  defaultProps: { items: [{ label: "Home", href: "/" }], sticky: false },
  allowedChildren: [],
  render: ({ props }) => (
    <nav className={`flex gap-6 ${props.sticky ? "sticky top-0 bg-background/95 backdrop-blur" : ""}`}>
      {props.items.map((item, i) => (
        <a key={i} href={item.href} className="text-sm font-medium hover:underline">
          {item.label}
        </a>
      ))}
    </nav>
  ),
};
