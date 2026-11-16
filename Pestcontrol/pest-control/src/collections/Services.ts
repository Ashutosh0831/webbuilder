import type { CollectionConfig } from "payload";
import { revalidateService } from '@/collections/hooks/revalidateService'

export const Services: CollectionConfig = {
  slug: "services",
  admin: { useAsTitle: "name" },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [revalidateService],
  },
  fields: [
    { name: "slug", type: "text", required: true, unique: true },
    { name: "name", type: "text", required: true },
    {
      name: "purpose",
      type: "textarea",
      admin: {
        description:
          'Briefly describe what this service is for (e.g., "kill cockroaches hiding in kitchen cavities")',
      },
    },
    {
      name: "aiGenerate",
      type: "ui",
      admin: {
        components: {
          Field: "@/components/AutoFillButton",
        },
      },
    },
    { name: "shortName", type: "text" },
    { name: "icon", type: "text" },
    { name: "headline", type: "text" },
    { name: "metaTitle", type: "text" },
    { name: "metaDescription", type: "textarea" },
    { name: "intro", type: "textarea" },
    {
      name: "harbourages",
      type: "array",
      fields: [{ name: "text", type: "text" }],
    },
    {
      name: "treatmentSteps",
      type: "array",
      fields: [
        { name: "title", type: "text" },
        { name: "description", type: "textarea" },
      ],
    },
    { name: "safetyNote", type: "textarea" },
    {
      name: "faqs",
      type: "array",
      fields: [
        { name: "q", type: "text" },
        { name: "a", type: "textarea" },
      ],
    },
  ],
};