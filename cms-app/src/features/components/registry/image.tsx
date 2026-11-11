import Image from "next/image";
import { z } from "zod";
import { imagePropsSchema, spacingSchema } from "../schemas";
import type { ComponentDefinition } from "../types";

const schema = imagePropsSchema.extend({ spacing: spacingSchema });

type Props = z.infer<typeof schema>;

export const imageComponent: ComponentDefinition<Props> = {
  key: "image",
  displayName: "Image",
  description: "Responsive image with required alt text",
  category: "media",
  icon: "Image",
  propsSchema: schema,
  defaultProps: {
    src: "https://placehold.co/800x450",
    alt: "Placeholder",
    spacing: "md",
  },
  allowedChildren: [],
  render: ({ props }) => (
    <div className={props.spacing === "none" ? "" : `mb-${props.spacing === "sm" ? "2" : props.spacing === "md" ? "4" : props.spacing === "lg" ? "6" : "10"}`}>
      <Image
        src={props.src}
        alt={props.alt}
        width={props.width ?? 1200}
        height={props.height ?? 675}
        className="h-auto w-full rounded-md"
      />
    </div>
  ),
};