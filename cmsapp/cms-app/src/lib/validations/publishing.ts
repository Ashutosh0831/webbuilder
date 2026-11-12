import { z } from "zod";

export const submitPublishRequestSchema = z.object({
  pageId: z.string().uuid(),
  websiteId: z.string().uuid(),
  changeNote: z.string().max(500).optional(),
});

export const reviewPublishRequestSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  comment: z.string().max(1000).optional(),
});