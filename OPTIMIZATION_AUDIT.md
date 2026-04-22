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

- not fixed yet

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

- not fixed yet

#### 5. Ingestion still assumes Italy while product now aims wider

The connector layer still encodes Italy-first assumptions:

- `CITY_BBOXES` includes only Italian cities
- Overpass records default `country: "Italy"`

Affected areas:

- `artifacts/api-server/src/connectors/types.ts`
- `artifacts/api-server/src/connectors/overpassConnector.ts`

Impact:

- blocks EU-scale targeting
- weakens `targetMarket` and avatar logic

Status:

- not fixed yet

#### 6. Product identity is inconsistent

The UI still presents the app as `Scopri Italia` / `Italy Gallery Map` while the actual product is a discovery + outreach CRM.

Affected areas:

- `artifacts/gallery-map/src/components/layout.tsx`
- `artifacts/gallery-map/index.html`
- `README.md`

Impact:

- conceptual drift
- confusing positioning
- harder onboarding

Status:

- not fixed yet

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

- not fixed yet

#### 8. Website enrichment is sequential

Official website enrichment runs in a record-by-record loop during import.

Affected area:

- `artifacts/api-server/src/services/importOrchestrator.ts`

Impact:

- slow imports
- long-running admin tasks

Status:

- not fixed yet

### P2 - Architecture And Cleanup

#### 9. Legacy schema residue still exists

`galleries.ts` is still in the repo even though `businesses` is the active model.

Affected area:

- `lib/db/src/schema/galleries.ts`

Impact:

- cognitive noise
- future confusion

Status:

- not fixed yet

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

- not fixed yet

#### 11. Unused/oversized UI surface

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

- add checked-in DB migrations
- add CI validation for build/typecheck

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

## Phase 4 - Workspace Coherence

- shared filters across dashboard, directory, map, and pipeline
- expose outreach status directly in directory
- add lightweight audit log for outreach actions
- tighten route/module ownership on the backend

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
