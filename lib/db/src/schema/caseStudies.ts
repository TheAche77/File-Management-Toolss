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

export const caseStudiesTable = pgTable(
  "case_studies",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    targetCluster: text("target_cluster"),
    engineType: text("engine_type"),
    artist: text("artist"),
    outcome: text("outcome"),
    sourceUrl: text("source_url"),
    tags: text("tags"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("case_studies_slug_idx").on(t.slug),
    index("case_studies_cluster_idx").on(t.targetCluster),
    index("case_studies_active_idx").on(t.active),
  ],
);

export const insertCaseStudySchema = createInsertSchema(caseStudiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCaseStudy = z.infer<typeof insertCaseStudySchema>;
export type CaseStudy = typeof caseStudiesTable.$inferSelect;
