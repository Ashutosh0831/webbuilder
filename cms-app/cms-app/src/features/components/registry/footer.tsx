import { z } from "zod";
import type { ComponentDefinition } from "../types";

const footerSchema = z.object({
  copyright: z.string().max(200),
  links: z.array(z.object({
    label: z.string().min(1).max(40),
    href: z.string().min(1).max(200),
  })).max(8).default([]),
});

type FooterProps = z.infer<typeof footerSchema>;

export const footerComponent: ComponentDefinition<FooterProps> = {
  key: "footer",
  displayName: "Footer",
  description: "Site footer with links",
  category: "navigation",
  icon: "LayoutPanelBottom",
  propsSchema: footerSchema,
  defaultProps: { copyright: "© 2025", links: [] },
  allowedChildren: [],
  render: ({ props }) => (
    <footer className="border-t py-8 text-center text-sm text-muted-foreground">
      <div className="flex justify-center gap-4">
        {props.links.map((l, i) => (
          <a key={i} href={l.href} className="hover:underline">{l.label}</a>
        ))}
      </div>
      <p className="mt-4">{props.copyright}</p>
    </footer>
  ),
};