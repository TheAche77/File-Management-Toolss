ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "engine_type" text,
  ADD COLUMN IF NOT EXISTS "target_type" text,
  ADD COLUMN IF NOT EXISTS "target_cluster" text,
  ADD COLUMN IF NOT EXISTS "economic_value_score" integer,
  ADD COLUMN IF NOT EXISTS "strategic_value_score" integer,
  ADD COLUMN IF NOT EXISTS "referral_value_score" integer,
  ADD COLUMN IF NOT EXISTS "prestige_value_score" integer,
  ADD COLUMN IF NOT EXISTS "continuity_revenue_potential" integer,
  ADD COLUMN IF NOT EXISTS "offer_fit_score" integer,
  ADD COLUMN IF NOT EXISTS "relationship_path_score" integer,
  ADD COLUMN IF NOT EXISTS "actionability_score" integer,
  ADD COLUMN IF NOT EXISTS "best_offer_id" integer,
  ADD COLUMN IF NOT EXISTS "best_narrative_id" integer,
  ADD COLUMN IF NOT EXISTS "secondary_narrative_id" integer,
  ADD COLUMN IF NOT EXISTS "best_credibility_asset_id" integer,
  ADD COLUMN IF NOT EXISTS "best_case_study_id" integer,
  ADD COLUMN IF NOT EXISTS "proof_angle" text,
  ADD COLUMN IF NOT EXISTS "risk_reduction_reason" text,
  ADD COLUMN IF NOT EXISTS "tone_of_approach" text,
  ADD COLUMN IF NOT EXISTS "recommended_pitch_angle" text,
  ADD COLUMN IF NOT EXISTS "next_best_contact_window" text,
  ADD COLUMN IF NOT EXISTS "account_tier" text,
  ADD COLUMN IF NOT EXISTS "seasonality_fit" text,
  ADD COLUMN IF NOT EXISTS "ready_for_relationship" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ready_for_institutional_pitch" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "prestige_watchlist" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cultivation_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "warm_path_exists" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "businesses_ready_for_relationship_idx" ON "businesses" ("ready_for_relationship");
CREATE INDEX IF NOT EXISTS "businesses_ready_for_institutional_pitch_idx" ON "businesses" ("ready_for_institutional_pitch");
CREATE INDEX IF NOT EXISTS "businesses_prestige_watchlist_idx" ON "businesses" ("prestige_watchlist");
CREATE INDEX IF NOT EXISTS "businesses_cultivation_required_idx" ON "businesses" ("cultivation_required");
CREATE INDEX IF NOT EXISTS "businesses_engine_type_idx" ON "businesses" ("engine_type");
CREATE INDEX IF NOT EXISTS "businesses_target_type_idx" ON "businesses" ("target_type");
CREATE INDEX IF NOT EXISTS "businesses_target_cluster_idx" ON "businesses" ("target_cluster");
CREATE INDEX IF NOT EXISTS "businesses_account_tier_idx" ON "businesses" ("account_tier");
CREATE INDEX IF NOT EXISTS "businesses_warm_path_exists_idx" ON "businesses" ("warm_path_exists");

CREATE TABLE IF NOT EXISTS "offers" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "engine_type" text NOT NULL,
  "offer_type" text NOT NULL,
  "summary" text,
  "target_clusters" text,
  "ticket_min" integer,
  "ticket_max" integer,
  "recurring_potential" integer,
  "bundleable" boolean NOT NULL DEFAULT false,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "offers_slug_idx" ON "offers" ("slug");
CREATE INDEX IF NOT EXISTS "offers_engine_type_idx" ON "offers" ("engine_type");
CREATE INDEX IF NOT EXISTS "offers_offer_type_idx" ON "offers" ("offer_type");
CREATE INDEX IF NOT EXISTS "offers_active_idx" ON "offers" ("active");

CREATE TABLE IF NOT EXISTS "narratives" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "summary" text,
  "tone_of_approach" text,
  "engine_types" text,
  "target_clusters" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "narratives_slug_idx" ON "narratives" ("slug");
CREATE INDEX IF NOT EXISTS "narratives_active_idx" ON "narratives" ("active");

CREATE TABLE IF NOT EXISTS "credibility_assets" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "asset_type" text NOT NULL,
  "summary" text,
  "source_url" text,
  "target_clusters" text,
  "engine_types" text,
  "tags" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "credibility_assets_slug_idx" ON "credibility_assets" ("slug");
CREATE INDEX IF NOT EXISTS "credibility_assets_type_idx" ON "credibility_assets" ("asset_type");
CREATE INDEX IF NOT EXISTS "credibility_assets_active_idx" ON "credibility_assets" ("active");

CREATE TABLE IF NOT EXISTS "case_studies" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "target_cluster" text,
  "engine_type" text,
  "artist" text,
  "outcome" text,
  "source_url" text,
  "tags" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "case_studies_slug_idx" ON "case_studies" ("slug");
CREATE INDEX IF NOT EXISTS "case_studies_cluster_idx" ON "case_studies" ("target_cluster");
CREATE INDEX IF NOT EXISTS "case_studies_active_idx" ON "case_studies" ("active");

CREATE TABLE IF NOT EXISTS "relationship_paths" (
  "id" serial PRIMARY KEY,
  "business_id" integer NOT NULL REFERENCES "businesses"("id"),
  "introducer_name" text,
  "introducer_org" text,
  "relationship_type" text NOT NULL,
  "confidence_score" numeric(4, 2) NOT NULL DEFAULT '0.50',
  "is_warm" boolean NOT NULL DEFAULT false,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "relationship_paths_business_idx" ON "relationship_paths" ("business_id");
CREATE INDEX IF NOT EXISTS "relationship_paths_is_warm_idx" ON "relationship_paths" ("is_warm");
CREATE INDEX IF NOT EXISTS "relationship_paths_type_idx" ON "relationship_paths" ("relationship_type");

CREATE TABLE IF NOT EXISTS "strategic_accounts" (
  "id" serial PRIMARY KEY,
  "business_id" integer NOT NULL REFERENCES "businesses"("id"),
  "account_type" text NOT NULL,
  "owner" text,
  "account_tier" text,
  "status" text NOT NULL DEFAULT 'active',
  "thesis" text,
  "milestone" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "strategic_accounts_business_type_idx" ON "strategic_accounts" ("business_id", "account_type");
CREATE INDEX IF NOT EXISTS "strategic_accounts_tier_idx" ON "strategic_accounts" ("account_tier");
CREATE INDEX IF NOT EXISTS "strategic_accounts_status_idx" ON "strategic_accounts" ("status");

CREATE TABLE IF NOT EXISTS "seasonal_windows" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "engine_type" text,
  "target_cluster" text,
  "start_month" integer NOT NULL,
  "end_month" integer NOT NULL,
  "note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "seasonal_windows_slug_idx" ON "seasonal_windows" ("slug");
CREATE INDEX IF NOT EXISTS "seasonal_windows_engine_idx" ON "seasonal_windows" ("engine_type");
CREATE INDEX IF NOT EXISTS "seasonal_windows_cluster_idx" ON "seasonal_windows" ("target_cluster");

CREATE TABLE IF NOT EXISTS "content_assets" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL,
  "asset_type" text NOT NULL,
  "engine_type" text,
  "target_cluster" text,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "content_assets_slug_idx" ON "content_assets" ("slug");
CREATE INDEX IF NOT EXISTS "content_assets_type_idx" ON "content_assets" ("asset_type");
CREATE INDEX IF NOT EXISTS "content_assets_engine_idx" ON "content_assets" ("engine_type");
CREATE INDEX IF NOT EXISTS "content_assets_cluster_idx" ON "content_assets" ("target_cluster");
