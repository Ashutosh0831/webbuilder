import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { sites, users } from "./users.js";
import {
  eventStatusEnum,
  jobStatusEnum,
  webhookDeliveryStatusEnum,
} from "./enums.js";

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").references(() => sites.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    siteCreatedIdx: index("audit_log_site_created_idx").on(
      t.siteId,
      t.createdAt
    ),
    entityIdx: index("audit_log_entity_idx").on(t.entityType, t.entityId),
  })
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").references(() => sites.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: eventStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (t) => ({
    statusCreatedIdx: index("events_status_created_idx").on(
      t.status,
      t.createdAt
    ),
    siteTypeIdx: index("events_site_type_idx").on(t.siteId, t.type),
  })
);

export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    events: text("events").array().notNull(),
    secret: text("secret").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    siteIdx: index("webhooks_site_idx").on(t.siteId),
  })
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
    responseCode: text("response_code"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    webhookIdx: index("webhook_deliveries_webhook_idx").on(t.webhookId),
    eventIdx: index("webhook_deliveries_event_idx").on(t.eventId),
  })
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    stack: text("stack").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    outputPath: text("output_path"),
    logs: text("logs"),
    triggeredBy: uuid("triggered_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => ({
    siteStatusIdx: index("generation_jobs_site_status_idx").on(
      t.siteId,
      t.status
    ),
  })
);

export const deployments = pgTable(
  "deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("PENDING"), // PENDING | BUILDING | READY | FAILED | CANCELLED
    target: text("target").notNull().default("local"), // local | docker | vercel
    domain: text("domain"),
    liveUrl: text("live_url"),
    outputPath: text("output_path"),
    logs: text("logs").notNull().default(""),
    errorMessage: text("error_message"),
    rollbackFromId: uuid("rollback_from_id"),
    triggeredBy: uuid("triggered_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => ({
    siteCreatedIdx: index("deployments_site_created_idx").on(
      t.siteId,
      t.createdAt
    ),
  })
);
