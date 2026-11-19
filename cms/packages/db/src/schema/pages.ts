import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { sites, users } from "./users.js";
import { contentStatusEnum, pageApprovalStatusEnum } from "./enums.js";

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),

    sectionKey: text("section_key").notNull(),

    title: text("title").notNull(),

    slug: text("slug").notNull(),

    // Original imported Markdown or text
    rawContent: text("raw_content"),

    // Structured page-builder blocks
    blocks: jsonb("blocks")
      .notNull()
      .default([]),

    // Existing parser output; retained for compatibility
    parsedSections: jsonb("parsed_sections")
      .notNull()
      .default([]),

    // Separate draft payload when editing an already-published page
    draftContent: jsonb("draft_content"),

    hasUnpublishedChanges: boolean("has_unpublished_changes")
      .notNull()
      .default(false),

    publishedVersion: integer("published_version"),

    status: contentStatusEnum("status")
      .notNull()
      .default("draft"),

    approvalStatus: pageApprovalStatusEnum("approval_status")
      .notNull()
      .default("draft"),

    assignedReviewerId: uuid("assigned_reviewer_id").references(() => users.id, { onDelete: "set null" }),
    reviewSubmittedAt: timestamp("review_submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewComment: text("review_comment"),
    scheduledPublishAt: timestamp("scheduled_publish_at", { withTimezone: true }),
    scheduledUnpublishAt: timestamp("scheduled_unpublish_at", { withTimezone: true }),

    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    seoCanonical: text("seo_canonical"),
    seoOgImage: text("seo_og_image"),
    seoRobots: text("seo_robots"),

    version: integer("version")
      .notNull()
      .default(1),

    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "set null" }),

    updatedBy: uuid("updated_by")
      .references(() => users.id, { onDelete: "set null" }),

    publishedAt: timestamp("published_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueSiteSectionSlug: uniqueIndex(
      "pages_site_section_slug_idx"
    ).on(
      table.siteId,
      table.sectionKey,
      table.slug
    ),

    siteStatusIdx: index(
      "pages_site_status_idx"
    ).on(
      table.siteId,
      table.status
    ),

    siteCreatedIdx: index(
      "pages_site_created_idx"
    ).on(
      table.siteId,
      table.createdAt
    ),
  })
);

export const pageReviewHistory = pgTable(
  "page_review_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
    pageVersion: integer("page_version").notNull(),
    action: text("action").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    assignedReviewerId: uuid("assigned_reviewer_id").references(() => users.id, { onDelete: "set null" }),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pageCreatedIdx: index("page_review_history_page_created_idx").on(table.pageId, table.createdAt),
    reviewerIdx: index("page_review_history_reviewer_idx").on(table.assignedReviewerId, table.createdAt),
  })
);
