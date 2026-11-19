import { pgEnum } from "drizzle-orm/pg-core";

export const contentStatusEnum = pgEnum("content_status", [
  "draft",
  "review",
  "scheduled",
  "published",
  "archived",
]);

export const pageApprovalStatusEnum = pgEnum("page_approval_status", [
  "draft",
  "in_review",
  "approved",
  "rejected",
]);

export const apiKeyTypeEnum = pgEnum("api_key_type", [
  "read",
  "write",
  "preview",
]);

export const siteRoleEnum = pgEnum("site_role", [
  "client_owner",
  "client_admin",
  "editor",
  "viewer",
]);

export const platformRoleEnum = pgEnum("platform_role", ["super_admin"]);

export const siteStatusEnum = pgEnum("site_status", [
  "active",
  "suspended",
  "archived",
]);

export const clientStatusEnum = pgEnum("client_status", [
  "active",
  "suspended",
  "archived",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "new",
  "read",
  "spam",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "pending",
  "processing",
  "processed",
  "failed",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "success",
  "failed",
]);
