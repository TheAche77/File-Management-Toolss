ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "overture_id" text,
  ADD COLUMN IF NOT EXISTS "wikidata_id" text,
  ADD COLUMN IF NOT EXISTS "geonames_id" text,
  ADD COLUMN IF NOT EXISTS "opencorporates_id" text,
  ADD COLUMN IF NOT EXISTS "data_quality_score" integer,
  ADD COLUMN IF NOT EXISTS "enrichment_source_count" integer,
  ADD COLUMN IF NOT EXISTS "last_enrichment_at" timestamp;

ALTER TABLE "business_sources"
  ADD COLUMN IF NOT EXISTS "source_payload_summary" text,
  ADD COLUMN IF NOT EXISTS "source_license" text,
  ADD COLUMN IF NOT EXISTS "source_attribution" text,
  ADD COLUMN IF NOT EXISTS "source_rate_limit_bucket" text;

CREATE INDEX IF NOT EXISTS "businesses_wikidata_id_idx" ON "businesses" ("wikidata_id");
CREATE INDEX IF NOT EXISTS "businesses_data_quality_score_idx" ON "businesses" ("data_quality_score");
CREATE INDEX IF NOT EXISTS "businesses_last_enrichment_at_idx" ON "businesses" ("last_enrichment_at");
