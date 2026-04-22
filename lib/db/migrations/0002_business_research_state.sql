ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "discovery_status" text NOT NULL DEFAULT 'discovered',
  ADD COLUMN IF NOT EXISTS "qualification_status" text NOT NULL DEFAULT 'unqualified',
  ADD COLUMN IF NOT EXISTS "contactability_status" text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "ranking_status" text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "source_health" text,
  ADD COLUMN IF NOT EXISTS "contact_readiness" text,
  ADD COLUMN IF NOT EXISTS "relevance_score" integer,
  ADD COLUMN IF NOT EXISTS "contactability_score" integer,
  ADD COLUMN IF NOT EXISTS "confidence_score" integer,
  ADD COLUMN IF NOT EXISTS "freshness_score" integer,
  ADD COLUMN IF NOT EXISTS "priority_score" integer,
  ADD COLUMN IF NOT EXISTS "research_score" integer,
  ADD COLUMN IF NOT EXISTS "official_source_count" integer,
  ADD COLUMN IF NOT EXISTS "successful_source_count" integer,
  ADD COLUMN IF NOT EXISTS "failed_source_count" integer,
  ADD COLUMN IF NOT EXISTS "primary_source_id" integer,
  ADD COLUMN IF NOT EXISTS "primary_contact_candidate_id" integer,
  ADD COLUMN IF NOT EXISTS "ready_for_outreach" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "review_required" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "review_reason" text,
  ADD COLUMN IF NOT EXISTS "top_gap" text,
  ADD COLUMN IF NOT EXISTS "recommended_next_step" text,
  ADD COLUMN IF NOT EXISTS "last_qualified_at" timestamp,
  ADD COLUMN IF NOT EXISTS "last_contactability_check_at" timestamp,
  ADD COLUMN IF NOT EXISTS "last_research_at" timestamp,
  ADD COLUMN IF NOT EXISTS "next_research_at" timestamp;

CREATE INDEX IF NOT EXISTS "businesses_ready_for_outreach_idx" ON "businesses" ("ready_for_outreach");
CREATE INDEX IF NOT EXISTS "businesses_review_required_idx" ON "businesses" ("review_required");
CREATE INDEX IF NOT EXISTS "businesses_priority_score_idx" ON "businesses" ("priority_score");
CREATE INDEX IF NOT EXISTS "businesses_research_score_idx" ON "businesses" ("research_score");
