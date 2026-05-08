import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const geoCitiesTable = pgTable(
  "geo_cities",
  {
    geonameId: integer("geoname_id").primaryKey(),
    name: text("name").notNull(),
    asciiName: text("ascii_name").notNull(),
    alternateNames: text("alternate_names"),
    countryCode: text("country_code").notNull(),
    admin1Code: text("admin1_code"),
    latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
    population: integer("population"),
    timezone: text("timezone"),
    modificationDate: date("modification_date", { mode: "string" }),
    normalizedName: text("normalized_name").notNull(),
    searchKey: text("search_key").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("geo_cities_country_normalized_idx").on(t.countryCode, t.normalizedName),
    index("geo_cities_search_key_idx").on(t.searchKey),
    index("geo_cities_country_population_idx").on(t.countryCode, t.population),
  ],
);

export const insertGeoCitySchema = createInsertSchema(geoCitiesTable).omit({
  createdAt: true,
});

export type InsertGeoCity = z.infer<typeof insertGeoCitySchema>;
export type GeoCity = typeof geoCitiesTable.$inferSelect;
