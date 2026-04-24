import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const seasonalWindowsTable = pgTable(
  "seasonal_windows",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    engineType: text("engine_type"),
    targetCluster: text("target_cluster"),
    startMonth: integer("start_month").notNull(),
    endMonth: integer("end_month").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("seasonal_windows_slug_idx").on(t.slug),
    index("seasonal_windows_engine_idx").on(t.engineType),
    index("seasonal_windows_cluster_idx").on(t.targetCluster),
  ],
);

export const insertSeasonalWindowSchema = createInsertSchema(seasonalWindowsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSeasonalWindow = z.infer<typeof insertSeasonalWindowSchema>;
export type SeasonalWindow = typeof seasonalWindowsTable.$inferSelect;
