# Optimization Audit And Fix Plan

Technical audit of the current synced `crea` branch after the discovery-to-outreach expansion.

## Executive Summary

The app has evolved into a stronger product than the original local-directory prototype:

- typed backend/frontend contracts are aligned
- imports are asynchronous
- provenance is tracked
- outreach workflow is now first-class
- recommendation and review workflows are integrated end-to-end

The biggest weaknesses are no longer basic architecture. They are:

1. deployment safety
2. import/enrichment scalability
3. product identity drift
4. remaining legacy assumptions from the Italy-only version
5. incomplete operational hardening

## Current Strengths

- `businesses` is now the correct canonical aggregate root.
- `business_sources` and `contact_candidates` are valuable new subsystems.
- OpenAPI + generated clients + frontend usage are mostly coherent.
- The app already supports a real operator workflow:
  - import
  - review
  - contact candidate triage
  - outreach tracking
  - follow-up planning

## Findings By Priority

### P0 - Security And Rollout Risk

#### 1. Admin auth previously failed open

Before this Phase 0 pass, protected routes became effectively public if `ADMIN_API_TOKEN` was missing.

Affected area:

- `artifacts/api-server/src/lib/adminAuth.ts`

Impact:

- review queue
- imports
- outreach dashboard
- outreach pipeline
- contact candidate review
- outreach editing

Status:

- fixed in this phase

#### 2. Critical env validation was incomplete

The API startup previously validated `PORT` only. That was too weak for a system that now relies on:

- `DATABASE_URL`
- `ADMIN_API_TOKEN`

Affected area:

- `artifacts/api-server/src/index.ts`

Status:

- fixed in this phase

#### 3. Schema rollout is still manual

The repo still depends on schema push in the target environment instead of checked-in migrations.

Affected areas:

- `lib/db/drizzle.config.ts`
- `DEPLOY_CHECKLIST.md`

Impact:

- environment drift
- risky deploys
- hard-to-reproduce breakage across machines

Status:

- fixed on `2026-04-24`

### P1 - Functional/Product Gaps

#### 4. Map view is truncated by API page-size cap

The frontend asks for `pageSize: 500`, but the backend caps `/businesses` at `100`.

Affected areas:

- `artifacts/gallery-map/src/pages/map.tsx`
- `artifacts/api-server/src/routes/businesses.ts`

Impact:

- map does not represent the full dataset
- operators may believe businesses are missing

Status:

- fixed on `2026-04-22`

#### 5. Ingestion still assumes Italy while product now aims wider

The connector layer previously encoded Italy-first assumptions:

- `CITY_BBOXES` included only Italian cities
- Overpass records defaulted to `country: "Italy"`

Affected areas:

- `artifacts/api-server/src/connectors/types.ts`
- `artifacts/api-server/src/connectors/overpassConnector.ts`

Impact:

- blocks EU-scale targeting
- weakens `targetMarket` and avatar logic

Status:

- fixed on `2026-05-05`
- `CITY_DISCOVERY_CONFIGS` now covers core SLG markets across IT, UK, NL, FR, ES, PT, DE, BE, AT, and USA
- imports now infer `country` and `targetMarket` from the selected discovery city
- unknown discovery cities now fail explicitly unless a caller passes an explicit bounding box

#### 6. Product identity was inconsistent

The UI and README previously presented the app as `Scopri Italia` / `Italy Gallery Map` while the actual product is a discovery + outreach CRM.

Affected areas:

- `artifacts/gallery-map/src/components/layout.tsx`
- `artifacts/gallery-map/index.html`
- `README.md`

Impact:

- conceptual drift
- confusing positioning
- harder onboarding

Status:

- UI fixed on `2026-04-22`
- README title/positioning fixed on `2026-05-05`

### P1 - Scalability And Data Flow

#### 7. Source/contact upserts are still N+1 heavy

Both source and candidate upserts do select/update loops per record.

Affected areas:

- `artifacts/api-server/src/services/businessSourceService.ts`
- `artifacts/api-server/src/services/contactCandidateService.ts`

Impact:

- poor import scalability
- more DB round-trips than necessary

Status:

- fixed on `2026-04-22`

#### 8. Website enrichment is sequential

Official website enrichment runs in a record-by-record loop during import.

Affected area:

- `artifacts/api-server/src/services/importOrchestrator.ts`

Impact:

- slow imports
- long-running admin tasks

Status:

- fixed on `2026-04-22`

### P2 - Architecture And Cleanup

#### 9. Legacy schema residue still exists

`galleries.ts` is still in the repo even though `businesses` is the active model.

Affected area:

- `lib/db/src/schema/galleries.ts`

Impact:

- cognitive noise
- future confusion

Status:

- fixed on `2026-05-05`
- `lib/db/src/schema/galleries.ts` has been removed
- legacy `/api/galleries` remains as a compatibility redirect to `/api/businesses`

#### 10. Route ownership is too concentrated

`routes/businesses.ts` owns:

- catalog
- stats
- review queue
- outreach
- imports
- export

Impact:

- harder maintenance
- higher merge friction

Status:

- fixed on `2026-05-05`
- `routes/businesses.ts` is now a thin composition router
- catalog, research, outreach, imports, exports, and shared serializers/filters are split under `artifacts/api-server/src/routes/businesses/`

#### 11. Unused/oversized UI surface

### P1 - Legal Data Enrichment

#### 12. Free/legal enrichment needed clearer source boundaries

The next enrichment layer now follows a stricter source policy:

- OSM/Overpass remains the default discovery source.
- Wikidata is implemented for conservative entity enrichment: external ID, official URL, phone when present, source hash, license, attribution, and payload summary.
- Overture Maps is intentionally documented but not enabled because global GeoParquet ingestion is operationally too heavy for this repo without a bounded DuckDB/CLI workflow.
- GeoNames has an offline mock path for city/admin normalization development without Docker/Postgres.
- OpenCorporates remains optional/disabled because it requires API account/token and plan-specific limits.
- EU/local open data remains plugin territory because each dataset has its own schema and license.

Status:

- fixed on `2026-05-07`
- added `0005_external_enrichment_provenance.sql`
- added a lightweight rate limiter, cache, Wikidata connector, and enrichment CLI scripts
- hardened `data_quality_score` to update after enriched, unchanged, missed, skipped, and failed enrichment outcomes
- added offline GeoNames mock enrichment using local `data/cities15000.txt`; real DB GeoNames remains deferred
- no paid, trial-only, Google Maps, LinkedIn, or personal social scraping connector was added

Runtime note:

- Wikidata DB verification is now repeatable with `pnpm run verify:wikidata-enrichment`, after `docker compose up -d postgres`.
- In the current Codex runtime, Docker is still unavailable (`docker` not on PATH and `/Applications/Docker.app` not present), so the script was added but could not be executed here.
- Real DB GeoNames remains intentionally deferred until Wikidata has passed real-DB single-business and batch verification.

The frontend includes a very broad `ui/` library compared to actual app needs.

Impact:

- higher maintenance surface
- more noise during development

Status:

- optional cleanup

## Phase Plan

## Phase 0 - Safety And Deploy Hardening

Goals:

- fail closed on protected routes
- validate critical env at startup
- update documentation so runtime expectations match code

Implementation in this phase:

- admin auth now denies access if `ADMIN_API_TOKEN` is missing
- API startup now validates:
  - `PORT`
  - `DATABASE_URL`
  - `ADMIN_API_TOKEN`

Remaining in Phase 0:

- none

Status:

- checked-in DB migrations exist through `0004_slg_growth_engine.sql`
- CI validation added on `2026-04-24`
- route modularization, SLG aliases, export contract coverage, advanced research filters, and operating console improvements completed on `2026-05-05`

## Phase 1 - Fix Current Broken User Flows

- fix map truncation
- add dedicated map endpoint or lifted cap
- debounce directory search
- move filters into URL state
- unify shell/title/copy around the real product identity

## Phase 2 - Import/Enrichment Performance

- bulk upsert `business_sources`
- bulk upsert `contact_candidates`
- parallelize official website enrichment with bounded concurrency
- add freshness/hash-based skip logic
- add step-level import timing metrics

## Phase 3 - Data Model And Market Expansion

- extend EU city coverage in `CITY_BBOXES`
- stop hardcoding `country: "Italy"`
- infer `targetMarket` at import time
- assign initial `avatarType` earlier in the pipeline

Status:

- first three items completed on `2026-05-05`
- `avatarType` remains a lower-priority pipeline enrichment item

## Phase 4 - Workspace Coherence

- shared filters across dashboard, directory, map, and pipeline
- expose outreach status directly in directory
- add lightweight audit log for outreach actions
- tighten route/module ownership on the backend

Status:

- completed for shared filter state and URL persistence across dashboard, directory, map, research, and pipeline
- completed for route/module ownership on the backend
- completed for outreach audit trail from prior pass
- directory now exposes SLG target type, best offer, actionability, offer fit, and relationship/institutional/prestige/cultivation flags

## SLG Growth Operating System Completion - 2026-05-05

Completed:

- `/api/slg/*` aliases added while preserving legacy `/api/offers`, `/api/narratives`, `/api/credibility-assets`, `/api/case-studies`, `/api/seasonal-windows`, `/api/content-assets`, `/api/relationship-paths`, and `/api/strategic-accounts`
- OpenAPI now documents advanced research filters and all operational CSV exports
- generated React client and Zod contracts regenerated from OpenAPI
- research filters now support `targetType`, `warmPathExists`, `readyForRelationship`, `readyForInstitutionalPitch`, `prestigeWatchlist`, and `cultivationRequired`
- dashboard now shows operational SLG queues for top revenue, institutional pitch, prestige watchlist, cultivation, referral-first, and LABirinto-fit opportunities
- business detail now surfaces relationship path, pitch snippet, proof snippet, CTA suggestion, offer, narrative, proof, timing, and next action
- SLG scoring improved for target type, category, market, narrative family, proof family, relationship strategy, and seasonality defaults

Verification commands:

- `./node_modules/.bin/orval --config ./orval.config.ts` from `lib/api-spec`
- `./node_modules/.bin/tsc --build`
- `./node_modules/.bin/tsc -p artifacts/api-server/tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p artifacts/gallery-map/tsconfig.json --noEmit`
- `/Users/streetlevelsgallery/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node artifacts/api-server/build.mjs`
- `PATH=/Users/streetlevelsgallery/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH artifacts/gallery-map/node_modules/.bin/vite build --config artifacts/gallery-map/vite.config.ts`

Runtime smoke tests remain environment-dependent because this local shell has no confirmed running Postgres/API process.

## Runtime Verification Hardening - 2026-05-05

Completed:

- added local Postgres `compose.yaml`
- added `0000_base_schema.sql` so blank databases can apply the checked-in migration chain
- made SLG reference seed additive and idempotent for partially seeded databases
- added `scripts/smoke-slg-runtime.mjs` and `pnpm run smoke:slg-runtime`
- updated runtime runbooks with database, migration, API, frontend, and smoke-test commands
- added a Vite dev proxy so frontend `/api` requests go to the local API on `http://localhost:8080` by default

Environment note:

- this Codex shell did not expose `pnpm`, Docker, `psql`, or `postgres` on PATH, so real DB/API/UI runtime smoke must be executed on a host with those tools available.

## Phase 5 - Optional Strategic Improvements

- either implement Google enrichment properly or isolate the stub from runtime orchestration
- remove or quarantine unused legacy and playground residue
- add tests around:
  - outreach patching
  - pipeline bucket logic
  - candidate primary selection
  - import dedupe

## Recommended Immediate Next Steps

1. complete Phase 0 with migrations + CI
2. fix map/data truncation
3. optimize source/contact upserts
4. expand EU city support
5. clean up legacy identity and naming
