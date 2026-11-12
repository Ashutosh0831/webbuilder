import { z } from "zod";
import { alignmentSchema, imagePropsSchema } from "../schemas";
import type { ComponentDefinition } from "../types";

const schema = z.object({
  heading: z.string().min(1).max(120),
  subheading: z.string().max(300).optional(),
  align: alignmentSchema,
  backgroundImage: imagePropsSchema.optional(),
  ctaLabel: z.string().max(40).optional(),
  ctaHref: z.string().optional(),
});

type Props = z.infer<typeof schema>;

export const heroComponent: ComponentDefinition<Props> = {
  key: "hero",
  displayName: "Hero",
  description: "Large banner with heading and optional CTA",
  category: "marketing",
  icon: "Sparkles",
  propsSchema: schema,
  defaultProps: {
    heading: "Welcome to our website",
    subheading: "A short tagline goes here.",
    align: "center",
  },
  allowedChildren: [],
  render: ({ props }) => (
    <section
      className={`relative rounded-lg bg-muted px-6 py-16 ${props.align === "center" ? "text-center" : props.align === "right" ? "text-right" : "text-left"}`}
      style={props.backgroundImage ? { backgroundImage: `url(${props.backgroundImage.src})`, backgroundSize: "cover" } : undefined}
    >
      <h1 className="text-4xl font-bold tracking-tight">{props.heading}</h1>
      {props.subheading && <p className="mt-4 text-lg text-muted-foreground">{props.subheading}</p>}
      {props.ctaLabel && props.ctaHref && (
        <a href={props.ctaHref} className="mt-8 inline-block rounded-md bg-primary px-6 py-3 text-primary-foreground">
          {props.ctaLabel}
        </a>
      )}
    </section>
  ),
};