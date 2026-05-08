CREATE TABLE IF NOT EXISTS "geo_cities" (
  "geoname_id" integer PRIMARY KEY,
  "name" text NOT NULL,
  "ascii_name" text NOT NULL,
  "alternate_names" text,
  "country_code" text NOT NULL,
  "admin1_code" text,
  "latitude" numeric(10, 7) NOT NULL,
  "longitude" numeric(10, 7) NOT NULL,
  "population" integer,
  "timezone" text,
  "modification_date" date,
  "normalized_name" text NOT NULL,
  "search_key" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "geo_cities_country_normalized_idx"
  ON "geo_cities" ("country_code", "normalized_name");
CREATE INDEX IF NOT EXISTS "geo_cities_search_key_idx"
  ON "geo_cities" ("search_key");
CREATE INDEX IF NOT EXISTS "geo_cities_country_population_idx"
  ON "geo_cities" ("country_code", "population");
