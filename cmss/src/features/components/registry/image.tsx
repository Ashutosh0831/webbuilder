import Image from "next/image";
import { z } from "zod";
import { imagePropsSchema, spacingSchema } from "../schemas";
import type { ComponentDefinition } from "../types";

const schema = imagePropsSchema.extend({ spacing: spacingSchema });

type Props = z.infer<typeof schema>;
const spacingMap = { none: "", sm: "mb-2", md: "mb-4", lg: "mb-6", xl: "mb-10" };

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
    <div className={spacingMap[props.spacing]}>
      <Image
        src={props.src}
        alt={props.alt}
        width={props.width ?? 1200}
        height={props.height ?? 675}
        unoptimized
        className="h-auto w-full rounded-md"
      />
    </div>
  ),
  editorFields: [
  { key: "src", label: "Image URL", control: { type: "image", altRequired: true }, group: "content" },
  { key: "alt", label: "Alt Text", control: { type: "text", maxLength: 200 }, group: "content" },
  { key: "spacing", label: "Spacing", control: { type: "spacing" }, group: "style" },
],
};