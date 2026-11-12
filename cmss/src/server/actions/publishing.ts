"use server";

import { revalidatePath } from "next/cache";
import {
  reviewPublishRequestSchema,
  submitPublishRequestSchema,
} from "@/lib/validations/publishing";
import {
  reviewPublishRequest,
  submitPublishRequest,
} from "@/server/services/publishing";

export async function submitPublishRequestAction(pageId: string, websiteId: string) {
  const parsed = submitPublishRequestSchema.safeParse({ pageId, websiteId });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await submitPublishRequest(parsed.data.pageId, parsed.data.websiteId, undefined);
    revalidatePath(`/dashboard/pages/${parsed.data.pageId}`);
    revalidatePath("/admin/publishing");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to submit publishing request" };
  }
}

export async function reviewPublishRequestAction(
  requestId: string,
  decision: "approve" | "reject"
) {
  const parsed = reviewPublishRequestSchema.safeParse({ requestId, decision });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await reviewPublishRequest(parsed.data.requestId, parsed.data.decision);
    revalidatePath("/admin/publishing");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to review publishing request" };
  }
}
