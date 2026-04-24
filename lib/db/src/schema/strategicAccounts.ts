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
import { businessesTable } from "./businesses";

export const strategicAccountsTable = pgTable(
  "strategic_accounts",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id),
    accountType: text("account_type").notNull(),
    owner: text("owner"),
    accountTier: text("account_tier"),
    status: text("status").notNull().default("active"),
    thesis: text("thesis"),
    milestone: text("milestone"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("strategic_accounts_business_type_idx").on(t.businessId, t.accountType),
    index("strategic_accounts_tier_idx").on(t.accountTier),
    index("strategic_accounts_status_idx").on(t.status),
  ],
);

export const insertStrategicAccountSchema = createInsertSchema(strategicAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStrategicAccount = z.infer<typeof insertStrategicAccountSchema>;
export type StrategicAccount = typeof strategicAccountsTable.$inferSelect;
