import {
  boolean,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const narrativesTable = pgTable(
  "narratives",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    summary: text("summary"),
    toneOfApproach: text("tone_of_approach"),
    engineTypes: text("engine_types"),
    targetClusters: text("target_clusters"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("narratives_slug_idx").on(t.slug),
    index("narratives_active_idx").on(t.active),
  ],
);

export const insertNarrativeSchema = createInsertSchema(narrativesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNarrative = z.infer<typeof insertNarrativeSchema>;
export type Narrative = typeof narrativesTable.$inferSelect;
