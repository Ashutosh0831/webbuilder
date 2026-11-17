
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { sites, users } from "./users.js";
import { contentStatusEnum } from "./enums.js";

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

    status: contentStatusEnum("status")
      .notNull()
      .default("draft"),

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
