import {
  boolean,
  index,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const researchViewsTable = pgTable(
  "research_views",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    scope: text("scope").notNull().default("global"),
    filtersJson: jsonb("filters_json").$type<Record<string, unknown>>().notNull().default({}),
    sortJson: jsonb("sort_json").$type<Record<string, unknown>>().notNull().default({}),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("research_views_scope_idx").on(t.scope),
    index("research_views_default_idx").on(t.isDefault),
  ],
);

export const insertResearchViewSchema = createInsertSchema(researchViewsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertResearchView = z.infer<typeof insertResearchViewSchema>;
export type ResearchView = typeof researchViewsTable.$inferSelect;
