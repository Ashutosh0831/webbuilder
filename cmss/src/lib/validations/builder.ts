import { z } from "zod";

interface SectionInput {
  id: string;
  componentKey: string;
  props: Record<string, unknown>;
  sortOrder: number;
  responsive?: {
    tablet?: Record<string, unknown>;
    desktop?: Record<string, unknown>;
  };
  children?: SectionInput[];
}

export const sectionSchema: z.ZodType<SectionInput> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    componentKey: z.string().min(1),
    props: z.record(z.string(), z.unknown()),
    sortOrder: z.number().int().min(0),
    responsive: z.object({
      tablet: z.record(z.string(), z.unknown()).optional(),
      desktop: z.record(z.string(), z.unknown()).optional(),
    }).optional(),
    children: z.array(sectionSchema).optional(),
  }),
);

export const saveDraftSchema = z.object({
  pageId: z.string().uuid(),
  websiteId: z.string().uuid(),
  version: z.number().int().min(0),
  sections: z.array(sectionSchema),
});