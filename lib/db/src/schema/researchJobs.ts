import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";
import { businessSourcesTable } from "./businessSources";

export const researchJobsTable = pgTable(
  "research_jobs",
  {
    id: serial("id").primaryKey(),
    jobType: text("job_type").notNull(),
    businessId: integer("business_id").references(() => businessesTable.id),
    sourceId: integer("source_id").references(() => businessSourcesTable.id),
    status: text("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(50),
    scheduledAt: timestamp("scheduled_at").notNull().defaultNow(),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    lockedAt: timestamp("locked_at"),
    lockToken: text("lock_token"),
    attemptCount: integer("attempt_count").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    resultSummary: jsonb("result_summary").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("research_jobs_status_idx").on(t.status, t.scheduledAt),
    index("research_jobs_business_idx").on(t.businessId),
    index("research_jobs_source_idx").on(t.sourceId),
    index("research_jobs_type_idx").on(t.jobType),
  ],
);

export const insertResearchJobSchema = createInsertSchema(researchJobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertResearchJob = z.infer<typeof insertResearchJobSchema>;
export type ResearchJob = typeof researchJobsTable.$inferSelect;
