import {
  pgTable,
  serial,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessesTable = pgTable(
  "businesses",
  {
    id: serial("id").primaryKey(),
    categorySlug: text("category_slug").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
    addressLine: text("address_line"),
    city: text("city"),
    postalCode: text("postal_code"),
    region: text("region"),
    country: text("country").default("Italy"),
    website: text("website"),
    phone: text("phone"),
    osmId: text("osm_id"),
    osmType: text("osm_type"),
    googlePlaceId: text("google_place_id"),
    googleMapsUrl: text("google_maps_url"),
    rating: numeric("rating", { precision: 3, scale: 1 }),
    userRatingsTotal: integer("user_ratings_total"),
    hasWebsite: boolean("has_website").notNull().default(false),
    hasPhone: boolean("has_phone").notNull().default(false),
    enrichmentStatus: text("enrichment_status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    lastCheckedAt: timestamp("last_checked_at"),
  },
  (t) => [
    uniqueIndex("businesses_category_osm_idx").on(t.categorySlug, t.osmId, t.osmType),
    uniqueIndex("businesses_slug_category_idx").on(t.slug, t.categorySlug),
    index("businesses_city_idx").on(t.city),
    index("businesses_category_idx").on(t.categorySlug),
    index("businesses_has_website_idx").on(t.hasWebsite),
  ],
);

export const insertBusinessSchema = createInsertSchema(businessesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businessesTable.$inferSelect;
