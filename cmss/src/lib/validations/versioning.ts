import { z } from "zod";

export const restoreVersionSchema = z.object({
  versionId: z.string().uuid(),
  websiteId: z.string().uuid(),
  pageId: z.string().uuid(),
});

export const compareVersionsSchema = z.object({
  versionAId: z.string().uuid(),
  versionBId: z.string().uuid(),
  websiteId: z.string().uuid(),
});

export const restoreContentVersionSchema = z.object({
  websiteId: z.string().uuid(),
  versionId: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
});