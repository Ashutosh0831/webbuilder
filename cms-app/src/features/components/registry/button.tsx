import Link from "next/link";
import { z } from "zod";
import type { ComponentDefinition } from "../types";

const schema = z.object({
  label: z.string().min(1).max(60),
  href: z.string().url().or(z.string().startsWith("/")),
  variant: z.enum(["primary", "secondary", "outline"]).default("primary"),
  size: z.enum(["sm", "md", "lg"]).default("md"),
});

type Props = z.infer<typeof schema>;

const variantClasses = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-input bg-background hover:bg-accent",
};

const sizeClasses = { sm: "px-3 py-1.5 text-sm", md: "px-5 py-2.5 text-base", lg: "px-7 py-3.5 text-lg" };

export const buttonComponent: ComponentDefinition<Props> = {
  key: "button",
  displayName: "Button",
  description: "Call-to-action link styled as a button",
  category: "marketing",
  icon: "MousePointerClick",
  propsSchema: schema,
  defaultProps: { label: "Click me", href: "#", variant: "primary", size: "md" },
  allowedChildren: [],
  render: ({ props }) => {
    const cls = `inline-block rounded-md font-medium transition ${variantClasses[props.variant]} ${sizeClasses[props.size]}`;
    // Internal link (starts with /) → Next Link; external → <a>
    if (props.href.startsWith("/")) {
      return <Link href={props.href} className={cls}>{props.label}</Link>;
    }
    return (
      <a href={props.href} className={cls} rel="noopener noreferrer" target="_blank">
        {props.label}
      </a>
    );
  },
};