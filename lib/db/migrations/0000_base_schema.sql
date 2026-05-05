CREATE TABLE IF NOT EXISTS "categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "label" text NOT NULL,
  "description" text,
  "osm_tags" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" ("slug");

CREATE TABLE IF NOT EXISTS "businesses" (
  "id" serial PRIMARY KEY NOT NULL,
  "category_slug" text NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "latitude" numeric(10, 7) NOT NULL,
  "longitude" numeric(10, 7) NOT NULL,
  "address_line" text,
  "city" text,
  "postal_code" text,
  "region" text,
  "country" text,
  "website" text,
  "phone" text,
  "osm_id" text,
  "osm_type" text,
  "google_place_id" text,
  "google_maps_url" text,
  "rating" numeric(3, 1),
  "user_ratings_total" integer,
  "has_website" boolean NOT NULL DEFAULT false,
  "has_phone" boolean NOT NULL DEFAULT false,
  "enrichment_status" text NOT NULL DEFAULT 'pending',
  "discovery_status" text NOT NULL DEFAULT 'discovered',
  "qualification_status" text NOT NULL DEFAULT 'unqualified',
  "contactability_status" text NOT NULL DEFAULT 'unknown',
  "ranking_status" text NOT NULL DEFAULT 'pending',
  "source_health" text,
  "contact_readiness" text,
  "relevance_score" integer,
  "contactability_score" integer,
  "confidence_score" integer,
  "freshness_score" integer,
  "priority_score" integer,
  "research_score" integer,
  "engine_type" text,
  "target_type" text,
  "target_cluster" text,
  "economic_value_score" integer,
  "strategic_value_score" integer,
  "referral_value_score" integer,
  "prestige_value_score" integer,
  "continuity_revenue_potential" integer,
  "offer_fit_score" integer,
  "relationship_path_score" integer,
  "actionability_score" integer,
  "official_source_count" integer,
  "successful_source_count" integer,
  "failed_source_count" integer,
  "primary_source_id" integer,
  "primary_contact_candidate_id" integer,
  "best_offer_id" integer,
  "best_narrative_id" integer,
  "secondary_narrative_id" integer,
  "best_credibility_asset_id" integer,
  "best_case_study_id" integer,
  "proof_angle" text,
  "risk_reduction_reason" text,
  "tone_of_approach" text,
  "recommended_pitch_angle" text,
  "next_best_contact_window" text,
  "account_tier" text,
  "seasonality_fit" text,
  "ready_for_relationship" boolean NOT NULL DEFAULT false,
  "ready_for_institutional_pitch" boolean NOT NULL DEFAULT false,
  "prestige_watchlist" boolean NOT NULL DEFAULT false,
  "cultivation_required" boolean NOT NULL DEFAULT false,
  "warm_path_exists" boolean NOT NULL DEFAULT false,
  "ready_for_outreach" boolean NOT NULL DEFAULT false,
  "review_required" boolean NOT NULL DEFAULT false,
  "review_reason" text,
  "top_gap" text,
  "recommended_next_step" text,
  "outreach_status" text NOT NULL DEFAULT 'not_contacted',
  "contact_name" text,
  "contact_role" text,
  "contact_email" text,
  "last_contact_date" date,
  "next_action_date" date,
  "assigned_artist" text,
  "assigned_artist_source" text,
  "avatar_type" text,
  "target_market" text,
  "notes" text,
  "warm_connection" text,
  "last_qualified_at" timestamp,
  "last_contactability_check_at" timestamp,
  "last_research_at" timestamp,
  "next_research_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "last_checked_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_category_osm_idx" ON "businesses" ("category_slug", "osm_id", "osm_type");
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_slug_category_idx" ON "businesses" ("slug", "category_slug");
CREATE INDEX IF NOT EXISTS "businesses_city_idx" ON "businesses" ("city");
CREATE INDEX IF NOT EXISTS "businesses_category_idx" ON "businesses" ("category_slug");
CREATE INDEX IF NOT EXISTS "businesses_has_website_idx" ON "businesses" ("has_website");
CREATE INDEX IF NOT EXISTS "businesses_outreach_status_idx" ON "businesses" ("outreach_status");
CREATE INDEX IF NOT EXISTS "businesses_next_action_idx" ON "businesses" ("next_action_date");
CREATE INDEX IF NOT EXISTS "businesses_assigned_artist_idx" ON "businesses" ("assigned_artist");
CREATE INDEX IF NOT EXISTS "businesses_avatar_type_idx" ON "businesses" ("avatar_type");
CREATE INDEX IF NOT EXISTS "businesses_target_market_idx" ON "businesses" ("target_market");
CREATE INDEX IF NOT EXISTS "businesses_ready_for_outreach_idx" ON "businesses" ("ready_for_outreach");
CREATE INDEX IF NOT EXISTS "businesses_ready_for_relationship_idx" ON "businesses" ("ready_for_relationship");
CREATE INDEX IF NOT EXISTS "businesses_ready_for_institutional_pitch_idx" ON "businesses" ("ready_for_institutional_pitch");
CREATE INDEX IF NOT EXISTS "businesses_prestige_watchlist_idx" ON "businesses" ("prestige_watchlist");
CREATE INDEX IF NOT EXISTS "businesses_cultivation_required_idx" ON "businesses" ("cultivation_required");
CREATE INDEX IF NOT EXISTS "businesses_review_required_idx" ON "businesses" ("review_required");
CREATE INDEX IF NOT EXISTS "businesses_priority_score_idx" ON "businesses" ("priority_score");
CREATE INDEX IF NOT EXISTS "businesses_research_score_idx" ON "businesses" ("research_score");
CREATE INDEX IF NOT EXISTS "businesses_engine_type_idx" ON "businesses" ("engine_type");
CREATE INDEX IF NOT EXISTS "businesses_target_type_idx" ON "businesses" ("target_type");
CREATE INDEX IF NOT EXISTS "businesses_target_cluster_idx" ON "businesses" ("target_cluster");
CREATE INDEX IF NOT EXISTS "businesses_account_tier_idx" ON "businesses" ("account_tier");
CREATE INDEX IF NOT EXISTS "businesses_warm_path_exists_idx" ON "businesses" ("warm_path_exists");

CREATE TABLE IF NOT EXISTS "import_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "category_slug" text NOT NULL,
  "city" text NOT NULL,
  "status" text NOT NULL DEFAULT 'running',
  "fetched" integer,
  "inserted" integer,
  "updated" integer,
  "skipped" integer,
  "errors" integer,
  "error_message" text,
  "started_at" timestamp NOT NULL DEFAULT now(),
  "finished_at" timestamp
);

CREATE TABLE IF NOT EXISTS "business_sources" (
  "id" serial PRIMARY KEY NOT NULL,
  "business_id" integer NOT NULL REFERENCES "businesses"("id"),
  "source_type" text NOT NULL,
  "source_url" text NOT NULL,
  "source_domain" text,
  "discovered_via" text,
  "fetch_status" text NOT NULL DEFAULT 'discovered',
  "last_fetched_at" timestamp,
  "content_hash" text,
  "http_status" integer,
  "is_official" boolean NOT NULL DEFAULT false,
  "source_priority" integer NOT NULL DEFAULT 50,
  "usefulness_score" integer,
  "next_fetch_at" timestamp,
  "freshness_status" text NOT NULL DEFAULT 'unknown',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "business_sources_unique_idx" ON "business_sources" ("business_id", "source_type", "source_url");
CREATE INDEX IF NOT EXISTS "business_sources_business_idx" ON "business_sources" ("business_id");
CREATE INDEX IF NOT EXISTS "business_sources_type_idx" ON "business_sources" ("source_type");
CREATE INDEX IF NOT EXISTS "business_sources_official_idx" ON "business_sources" ("is_official");
CREATE INDEX IF NOT EXISTS "business_sources_next_fetch_idx" ON "business_sources" ("next_fetch_at");
CREATE INDEX IF NOT EXISTS "business_sources_freshness_idx" ON "business_sources" ("freshness_status");

CREATE TABLE IF NOT EXISTS "contact_candidates" (
  "id" serial PRIMARY KEY NOT NULL,
  "business_id" integer NOT NULL REFERENCES "businesses"("id"),
  "full_name" text,
  "role" text,
  "contact_type" text NOT NULL,
  "email" text,
  "phone" text,
  "contact_url" text,
  "source_url" text NOT NULL,
  "source_type" text NOT NULL,
  "confidence_score" numeric(4, 2) NOT NULL DEFAULT '0.50',
  "is_primary" boolean NOT NULL DEFAULT false,
  "is_personal_data" boolean NOT NULL DEFAULT false,
  "last_verified_at" timestamp,
  "verification_status" text NOT NULL DEFAULT 'unverified',
  "is_reachable" boolean NOT NULL DEFAULT false,
  "is_decision_maker_likely" boolean NOT NULL DEFAULT false,
  "channel_priority" integer NOT NULL DEFAULT 50,
  "source_priority" integer NOT NULL DEFAULT 50,
  "next_verification_at" timestamp,
  "review_status" text NOT NULL DEFAULT 'suggested',
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "contact_candidates_unique_idx" ON "contact_candidates" ("business_id", "contact_type", "source_type", "source_url");
CREATE INDEX IF NOT EXISTS "contact_candidates_business_idx" ON "contact_candidates" ("business_id");
CREATE INDEX IF NOT EXISTS "contact_candidates_type_idx" ON "contact_candidates" ("contact_type");
CREATE INDEX IF NOT EXISTS "contact_candidates_review_idx" ON "contact_candidates" ("review_status");
CREATE INDEX IF NOT EXISTS "contact_candidates_verification_idx" ON "contact_candidates" ("verification_status");
CREATE INDEX IF NOT EXISTS "contact_candidates_next_verification_idx" ON "contact_candidates" ("next_verification_at");
