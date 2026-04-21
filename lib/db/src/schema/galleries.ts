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

export const galleriesTable = pgTable(
  "galleries",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
    addressLine: text("address_line"),
    city: text("city"),
    postalCode: text("postal_code"),
    region: text("region"),
    country: text("country").default("Italy"),
    website: text("website"),
    phone: text("phone"),
    sourcePrimary: text("source_primary").notNull().default("osm"),
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
    uniqueIndex("galleries_osm_id_type_idx").on(t.osmId, t.osmType),
    index("galleries_city_idx").on(t.city),
    index("galleries_source_idx").on(t.sourcePrimary),
    index("galleries_has_website_idx").on(t.hasWebsite),
  ],
);

export const insertGallerySchema = createInsertSchema(galleriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGallery = z.infer<typeof insertGallerySchema>;
export type Gallery = typeof galleriesTable.$inferSelect;
