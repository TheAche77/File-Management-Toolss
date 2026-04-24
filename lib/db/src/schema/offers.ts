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

export const offersTable = pgTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    engineType: text("engine_type").notNull(),
    offerType: text("offer_type").notNull(),
    summary: text("summary"),
    targetClusters: text("target_clusters"),
    ticketMin: integer("ticket_min"),
    ticketMax: integer("ticket_max"),
    recurringPotential: integer("recurring_potential"),
    bundleable: boolean("bundleable").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("offers_slug_idx").on(t.slug),
    index("offers_engine_type_idx").on(t.engineType),
    index("offers_offer_type_idx").on(t.offerType),
    index("offers_active_idx").on(t.active),
  ],
);

export const insertOfferSchema = createInsertSchema(offersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Offer = typeof offersTable.$inferSelect;
