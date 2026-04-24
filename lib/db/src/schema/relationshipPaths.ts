import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const relationshipPathsTable = pgTable(
  "relationship_paths",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    introducerName: text("introducer_name"),
    introducerOrg: text("introducer_org"),
    relationshipType: text("relationship_type").notNull(),
    confidenceScore: numeric("confidence_score", { precision: 4, scale: 2 }).notNull().default("0.50"),
    isWarm: boolean("is_warm").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("relationship_paths_business_idx").on(t.businessId),
    index("relationship_paths_is_warm_idx").on(t.isWarm),
    index("relationship_paths_type_idx").on(t.relationshipType),
  ],
);

export const insertRelationshipPathSchema = createInsertSchema(relationshipPathsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRelationshipPath = z.infer<typeof insertRelationshipPathSchema>;
export type RelationshipPath = typeof relationshipPathsTable.$inferSelect;
