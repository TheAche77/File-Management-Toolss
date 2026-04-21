import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const contactCandidatesTable = pgTable(
  "contact_candidates",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    fullName: text("full_name"),
    role: text("role"),
    contactType: text("contact_type").notNull(),
    email: text("email"),
    phone: text("phone"),
    contactUrl: text("contact_url"),
    sourceUrl: text("source_url").notNull(),
    sourceType: text("source_type").notNull(),
    confidenceScore: numeric("confidence_score", { precision: 4, scale: 2 })
      .notNull()
      .default("0.50"),
    isPrimary: boolean("is_primary").notNull().default(false),
    isPersonalData: boolean("is_personal_data").notNull().default(false),
    lastVerifiedAt: timestamp("last_verified_at"),
    reviewStatus: text("review_status").notNull().default("suggested"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("contact_candidates_unique_idx").on(
      t.businessId,
      t.contactType,
      t.sourceType,
      t.sourceUrl,
    ),
    index("contact_candidates_business_idx").on(t.businessId),
    index("contact_candidates_type_idx").on(t.contactType),
    index("contact_candidates_review_idx").on(t.reviewStatus),
  ],
);

export const insertContactCandidateSchema = createInsertSchema(contactCandidatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContactCandidate = z.infer<typeof insertContactCandidateSchema>;
export type ContactCandidate = typeof contactCandidatesTable.$inferSelect;
