import { z } from "zod";

interface SectionInput {
  id: string;
  componentKey: string;
  props: unknown;
  sortOrder: number;
  children?: SectionInput[];
}

export const sectionSchema: z.ZodType<SectionInput> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    componentKey: z.string().min(1),
    props: z.unknown(),
    sortOrder: z.number().int().min(0),
    children: z.array(sectionSchema).optional(),
  }),
);

export const saveDraftSchema = z.object({
  pageId: z.string().uuid(),
  websiteId: z.string().uuid(),
  version: z.number().int().min(0),
  sections: z.array(sectionSchema),
});