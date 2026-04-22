CREATE TABLE IF NOT EXISTS "outreach_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "business_id" integer NOT NULL REFERENCES "businesses"("id"),
  "event_type" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" integer,
  "actor_type" text NOT NULL DEFAULT 'admin_token',
  "summary" text NOT NULL,
  "changed_fields" text[] NOT NULL DEFAULT '{}'::text[],
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "outreach_events_business_idx" ON "outreach_events" ("business_id");
CREATE INDEX IF NOT EXISTS "outreach_events_type_idx" ON "outreach_events" ("event_type");
CREATE INDEX IF NOT EXISTS "outreach_events_created_at_idx" ON "outreach_events" ("created_at");

ALTER TABLE "businesses"
  ALTER COLUMN "country" DROP DEFAULT;
