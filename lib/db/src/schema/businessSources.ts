import {
  boolean,
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
import { businessesTable } from "./businesses";

export const businessSourcesTable = pgTable(
  "business_sources",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    sourceType: text("source_type").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceDomain: text("source_domain"),
    discoveredVia: text("discovered_via"),
    fetchStatus: text("fetch_status").notNull().default("discovered"),
    lastFetchedAt: timestamp("last_fetched_at"),
    contentHash: text("content_hash"),
    sourcePayloadSummary: text("source_payload_summary"),
    sourceLicense: text("source_license"),
    sourceAttribution: text("source_attribution"),
    sourceRateLimitBucket: text("source_rate_limit_bucket"),
    httpStatus: integer("http_status"),
    isOfficial: boolean("is_official").notNull().default(false),
    sourcePriority: integer("source_priority").notNull().default(50),
    usefulnessScore: integer("usefulness_score"),
    nextFetchAt: timestamp("next_fetch_at"),
    freshnessStatus: text("freshness_status").notNull().default("unknown"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("business_sources_unique_idx").on(t.businessId, t.sourceType, t.sourceUrl),
    index("business_sources_business_idx").on(t.businessId),
    index("business_sources_type_idx").on(t.sourceType),
    index("business_sources_official_idx").on(t.isOfficial),
    index("business_sources_next_fetch_idx").on(t.nextFetchAt),
    index("business_sources_freshness_idx").on(t.freshnessStatus),
  ],
);

export const insertBusinessSourceSchema = createInsertSchema(businessSourcesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBusinessSource = z.infer<typeof insertBusinessSourceSchema>;
export type BusinessSource = typeof businessSourcesTable.$inferSelect;
