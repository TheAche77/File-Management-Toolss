import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const outreachEventsTable = pgTable(
  "outreach_events",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    actorType: text("actor_type").notNull().default("admin_token"),
    summary: text("summary").notNull(),
    changedFields: text("changed_fields")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("outreach_events_business_idx").on(t.businessId),
    index("outreach_events_type_idx").on(t.eventType),
    index("outreach_events_created_at_idx").on(t.createdAt),
  ],
);

export const insertOutreachEventSchema = createInsertSchema(outreachEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertOutreachEvent = z.infer<typeof insertOutreachEventSchema>;
export type OutreachEvent = typeof outreachEventsTable.$inferSelect;
