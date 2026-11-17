import { pgTable, uuid, integer, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { pages } from "./pages.js";
import { users } from "./users.js";

export const pageRevisions = pgTable(
  "page_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pageVersionIdx: uniqueIndex("page_revisions_page_version_idx").on(table.pageId, table.version),
    pageCreatedIdx: index("page_revisions_page_created_idx").on(table.pageId, table.createdAt),
  }),
);
