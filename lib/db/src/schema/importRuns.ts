import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const importRunsTable = pgTable("import_runs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  categorySlug: text("category_slug").notNull(),
  city: text("city").notNull(),
  status: text("status").notNull().default("running"),
  fetched: integer("fetched"),
  inserted: integer("inserted"),
  updated: integer("updated"),
  skipped: integer("skipped"),
  errors: integer("errors"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export const insertImportRunSchema = createInsertSchema(importRunsTable).omit({
  id: true,
  startedAt: true,
});
export type InsertImportRun = z.infer<typeof insertImportRunSchema>;
export type ImportRun = typeof importRunsTable.$inferSelect;
