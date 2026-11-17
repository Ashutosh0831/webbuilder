import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sites, users } from "./users.js";
import { contentEntries } from "./content.js";

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    storageKey: text("storage_key").notNull(),
    url: text("url").notNull(),
    mime: text("mime").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    altText: text("alt_text"),
    caption: text("caption"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    siteIdx: index("media_site_idx").on(t.siteId),
    storageKeyIdx: uniqueIndex("media_storage_key_idx").on(t.storageKey),
  })
);

export const mediaVariants = pgTable(
  "media_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    variant: text("variant").notNull(),
    url: text("url").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueMediaVariant: uniqueIndex("media_variants_unique_idx").on(
      t.mediaId,
      t.variant
    ),
  })
);

export const mediaUsages = pgTable(
  "media_usages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => contentEntries.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    mediaIdx: index("media_usages_media_idx").on(t.mediaId),
    entryIdx: index("media_usages_entry_idx").on(t.entryId),
  })
);
