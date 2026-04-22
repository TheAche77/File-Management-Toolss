ALTER TABLE "business_sources"
  ADD COLUMN IF NOT EXISTS "source_priority" integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "usefulness_score" integer,
  ADD COLUMN IF NOT EXISTS "next_fetch_at" timestamp,
  ADD COLUMN IF NOT EXISTS "freshness_status" text NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS "business_sources_next_fetch_idx" ON "business_sources" ("next_fetch_at");
CREATE INDEX IF NOT EXISTS "business_sources_freshness_idx" ON "business_sources" ("freshness_status");

ALTER TABLE "contact_candidates"
  ADD COLUMN IF NOT EXISTS "verification_status" text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS "is_reachable" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_decision_maker_likely" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "channel_priority" integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "source_priority" integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "next_verification_at" timestamp;

CREATE INDEX IF NOT EXISTS "contact_candidates_verification_idx" ON "contact_candidates" ("verification_status");
CREATE INDEX IF NOT EXISTS "contact_candidates_next_verification_idx" ON "contact_candidates" ("next_verification_at");

CREATE TABLE IF NOT EXISTS "research_jobs" (
  "id" serial PRIMARY KEY,
  "job_type" text NOT NULL,
  "business_id" integer REFERENCES "businesses"("id"),
  "source_id" integer REFERENCES "business_sources"("id"),
  "status" text NOT NULL DEFAULT 'queued',
  "priority" integer NOT NULL DEFAULT 50,
  "scheduled_at" timestamp NOT NULL DEFAULT now(),
  "started_at" timestamp,
  "finished_at" timestamp,
  "locked_at" timestamp,
  "lock_token" text,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "error_code" text,
  "error_message" text,
  "payload" jsonb,
  "result_summary" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "research_jobs_status_idx" ON "research_jobs" ("status", "scheduled_at");
CREATE INDEX IF NOT EXISTS "research_jobs_business_idx" ON "research_jobs" ("business_id");
CREATE INDEX IF NOT EXISTS "research_jobs_source_idx" ON "research_jobs" ("source_id");
CREATE INDEX IF NOT EXISTS "research_jobs_type_idx" ON "research_jobs" ("job_type");

CREATE TABLE IF NOT EXISTS "research_views" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "scope" text NOT NULL DEFAULT 'global',
  "filters_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "sort_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "research_views_scope_idx" ON "research_views" ("scope");
CREATE INDEX IF NOT EXISTS "research_views_default_idx" ON "research_views" ("is_default");
