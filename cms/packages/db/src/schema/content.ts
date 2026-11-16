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
import { sites, users } from "./users";
import { contentStatusEnum } from "./enums";

export const contentTypes = pgTable(
  "content_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").references(() => sites.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    fieldSchema: jsonb("field_schema").notNull(),
    urlEnabled: boolean("url_enabled").notNull().default(false),
    templateEnabled: boolean("template_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueSiteTypeKey: uniqueIndex("content_types_site_key_idx").on(
      t.siteId,
      t.key
    ),
  })
);

export const contentEntries = pgTable(
  "content_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    contentTypeId: uuid("content_type_id")
      .notNull()
      .references(() => contentTypes.id, { onDelete: "restrict" }),
    locale: text("locale").notNull().default("en"),
    slug: text("slug").notNull(),
    data: jsonb("data").notNull().default({}),
    status: contentStatusEnum("status").notNull().default("draft"),
    publishAt: timestamp("publish_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    seoCanonical: text("seo_canonical"),
    seoOgImage: text("seo_og_image"),
    seoRobots: text("seo_robots"),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueSiteTypeLocaleSlug: uniqueIndex(
      "content_entries_unique_idx"
    ).on(t.siteId, t.contentTypeId, t.locale, t.slug),
    siteStatusIdx: index("content_entries_site_status_idx").on(
      t.siteId,
      t.status
    ),
    typeIdx: index("content_entries_type_idx").on(t.contentTypeId),
    slugIdx: index("content_entries_slug_idx").on(t.slug),
  })
);

export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => contentEntries.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    data: jsonb("data").notNull(),
    seo: jsonb("seo").notNull().default({}),
    status: contentStatusEnum("status").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    entryVersionIdx: uniqueIndex("content_revisions_unique_idx").on(
      t.entryId,
      t.version
    ),
  })
);

export const contentLocks = pgTable(
  "content_locks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => contentEntries.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lockedAt: timestamp("locked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    entryIdx: uniqueIndex("content_locks_entry_idx").on(t.entryId),
  })
);

export const contentRelations = pgTable(
  "content_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromEntryId: uuid("from_entry_id")
      .notNull()
      .references(() => contentEntries.id, { onDelete: "cascade" }),
    toEntryId: uuid("to_entry_id")
      .notNull()
      .references(() => contentEntries.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    fromTypeIdx: index("content_relations_from_idx").on(
      t.fromEntryId,
      t.relationType
    ),
    toIdx: index("content_relations_to_idx").on(t.toEntryId),
  })
);