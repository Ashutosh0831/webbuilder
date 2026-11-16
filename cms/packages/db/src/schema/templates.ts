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
import { sites } from "./users";

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").references(() => sites.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    appliesTo: text("applies_to").notNull(),
    templateText: text("template_text").notNull(),
    variableMap: jsonb("variable_map").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    siteAppliesIdx: index("templates_site_applies_idx").on(
      t.siteId,
      t.appliesTo
    ),
    uniqueSiteKey: uniqueIndex("templates_site_key_idx").on(
      t.siteId,
      t.key
    ),
  })
);

export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    oldPath: text("old_path").notNull(),
    newPath: text("new_path").notNull(),
    statusCode: integer("status_code").notNull().default(301),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueSitePath: uniqueIndex("redirects_site_path_idx").on(
      t.siteId,
      t.oldPath
    ),
  })
);