# Product And Engineering Roadmap

This roadmap turns the current app into a production-ready local business discovery and contact research platform, while staying inside a legally defensible operating model.

It includes:

- follow-up work after the latest push on `codex/data-enrichment-bulk-merge`
- data quality and enrichment improvements
- frontend and API improvements
- compliance guardrails
- delivery phases with clear outcomes

## Current Baseline

The latest pushed branch already improved the import path by adding:

- normalization for city, website, and phone
- bulk-aware merge flow
- better skip/update/insert accounting during import
- more structured enrichment status handling

That gives us a stronger ingestion base, but the app still needs:

- async job processing
- admin security
- better review workflows
- richer source tracking
- contact candidate modeling
- compliance and auditability

## Product Vision

Build a system that can:

- discover legitimate business entities across Italy
- enrich them from official and public sources
- identify the best lawful contact path per business
- rank confidence and outreach readiness
- keep records fresh over time
- support operator review for ambiguous cases

## Non-Negotiable Legal And Data Policy

We will only automate collection from sources that are lawful and operationally defensible for this product.

Allowed by default:

- official business websites
- contact pages, footer, privacy pages, team pages
- OpenStreetMap / Overpass
- Google Places API
- structured metadata such as `schema.org` and `sameAs`
- public registries and official company directories, where terms allow it
- official business social links when discovered from the official website or official structured data

Not allowed as automated enrichment:

- scraping personal LinkedIn profiles
- mass scraping of LinkedIn search or profile pages
- harvesting personal data from platforms where terms prohibit automated extraction
- collecting data that is not necessary for the business purpose

Process rules:

- every extracted field must store source URL and timestamp
- personal contacts must be minimized and reviewed
- confidence must be explicit, not implied
- uncertain matches go to review, not directly to production truth

## Roadmap Principles

- prefer source traceability over hidden heuristics
- prefer incremental enrichment over full reprocessing
- prefer business usefulness over raw volume
- prefer reviewable confidence over aggressive guessing
- prefer modular pipelines over large route handlers

## Target Data Model

### Extend `businesses`

Add or plan these fields:

- `normalized_name`
- `normalized_city`
- `normalized_website`
- `normalized_phone`
- `geo_bucket`
- `source_hash`
- `enrichment_source`
- `enrichment_version`
- `confidence_score`
- `review_status`
- `next_enrichment_at`
- `official_website_status`
- `last_source_change_at`

Purpose:

- stronger matching
- fast freshness checks
- easier filtering and ranking

### Add `business_sources`

One row per discovered source for a business.

Suggested fields:

- `id`
- `business_id`
- `source_type`
- `source_url`
- `source_domain`
- `discovered_via`
- `fetch_status`
- `last_fetched_at`
- `content_hash`
- `http_status`
- `is_official`

Purpose:

- explain where data came from
- re-fetch selectively
- support audits and review

### Add `contact_candidates`

This is the core model for deep research.

Suggested fields:

- `id`
- `business_id`
- `full_name`
- `role`
- `contact_type`
- `email`
- `phone`
- `contact_url`
- `source_url`
- `source_type`
- `confidence_score`
- `is_primary`
- `is_personal_data`
- `last_verified_at`
- `review_status`
- `notes`

Supported `contact_type` examples:

- `owner`
- `founder`
- `director`
- `manager`
- `press`
- `general_contact`

Purpose:

- keep multiple possible contacts
- separate extracted candidates from approved primary contact

### Add `business_change_log`

Suggested fields:

- `id`
- `business_id`
- `field_name`
- `old_value`
- `new_value`
- `change_source`
- `changed_at`
- `run_id`

Purpose:

- support explainability
- enable manual review
- track freshness and regressions

### Optional staging tables

- `business_import_staging`
- `business_enrichment_tasks`

Purpose:

- decouple raw ingestion from merge
- support async processing

## Delivery Phases

## Phase 0: Stabilize The Foundation

Goal:

- make the current import and query experience reliable enough to build on

Deliverables:

- merge latest branch into working branch or main integration branch
- fix obvious UI bugs
- add typecheck and lint in CI
- confirm DB migration strategy
- create `docs/` or root documentation standard

Concrete tasks:

- fix the pagination text bug in `businesses.tsx`
- align dashboard wording with actual enrichment reality
- review route naming consistency for `/export` vs `/exports`
- document environment variables
- add health check coverage for DB connection

Success criteria:

- app builds consistently
- branch protections or at least PR flow exist
- documentation exists for running API, frontend, DB

## Phase 1: Async Import And Better Ingestion

Goal:

- stop blocking the request lifecycle for heavy imports

Deliverables:

- job-based import execution
- live import progress
- import state machine

Backend tasks:

- convert `POST /imports/run` into job creation
- add `GET /imports/runs/{id}` for status
- optionally add `GET /imports/runs/{id}/logs`
- use `import_runs` as a real progress tracker
- split import into steps:
  - fetch
  - normalize
  - merge
  - post-process

Frontend tasks:

- admin import progress card
- progress polling while a job is running
- disable duplicate imports on the same target

Success criteria:

- admin can trigger an import without holding open the whole request
- import history reflects intermediate states

## Phase 2: Source-Aware Enrichment

Goal:

- make enrichment explainable and incremental

Deliverables:

- source registry
- per-source fetch tracking
- selective re-enrichment

Tasks:

- add `business_sources`
- store all source URLs discovered during import and enrichment
- hash content fetched from websites
- skip parsing when source hash has not changed
- schedule re-checks only when stale

Source priority policy:

1. official website
2. Google Places
3. OpenStreetMap
4. official registries
5. allowed third-party directories

Success criteria:

- every important field can be traced to a source
- no expensive full reprocessing when nothing changed

## Phase 3: Official Website Intelligence

Goal:

- turn the official website into the main enrichment layer

Deliverables:

- website fetcher
- structured data parser
- contact page parser
- team page parser

Tasks:

- discover likely official website from:
  - OSM
  - Google Places
  - `sameAs` schema
  - existing saved website
- fetch and parse:
  - homepage
  - contact page
  - about page
  - team/staff page
  - privacy page
- extract:
  - company email
  - named emails
  - phone numbers
  - roles
  - submission policy
  - language
  - social links

Use AI only for:

- structured extraction from already-fetched allowed content
- ranking likely contacts
- summarizing contact policy

Success criteria:

- the system can identify and store a better official contact path for a meaningful portion of businesses

## Phase 4: Contact Candidate Graph

Goal:

- model real outreach options instead of a single weak contact field

Deliverables:

- `contact_candidates`
- candidate ranking
- one approved primary contact per business

Tasks:

- extract multiple candidates from official sources
- assign `contact_type`
- add confidence scoring
- allow operator to mark one as primary
- support generic company contact even if no person is known

Scoring hints:

- highest score: named person + role + official domain email
- medium score: named person + role only
- lower score: generic team alias or contact form
- lowest usable score: only general inbox or phone

Success criteria:

- every business can have multiple candidate contacts with evidence
- primary contact is a deliberate choice, not a side effect

## Phase 5: Review Queue And Human Oversight

Goal:

- keep bad data out of the production truth layer

Deliverables:

- review queue UI
- triage actions
- audit trail

Tasks:

- add `review_status` on businesses and contact candidates
- queue items for review when:
  - conflicting sources exist
  - only weak signals are found
  - candidate confidence is below threshold
  - enrichment changes previously verified data
- add UI actions:
  - approve
  - reject
  - mark as stale
  - choose primary contact
  - add operator note

Success criteria:

- ambiguous records do not silently overwrite trusted data

## Phase 6: Search, Ranking, And Usability

Goal:

- make the app operationally useful for real research and outreach

Deliverables:

- richer search and filtering
- business detail page
- better map behavior

Directory improvements:

- filters for:
  - `hasPhone`
  - `enrichmentStatus`
  - `reviewStatus`
  - `confidenceScore`
  - `hasPrimaryContact`
  - `category`
  - `city`
- debounced search
- saved filter presets
- export current filtered view

Detail page improvements:

- add `/businesses/:id`
- show:
  - business summary
  - source list
  - contact candidates
  - confidence reasons
  - import history
  - change history

Map improvements:

- marker clustering
- viewport-aware fetching
- category filter on map
- selected business side panel

Success criteria:

- operators can move from dataset to action without leaving the app

## Phase 7: Google Places Enrichment

Goal:

- use Google as selective high-value enrichment, not as broad scraping

Deliverables:

- implemented `GooglePlacesConnector`
- selective enrichment rules

Tasks:

- only enrich businesses missing high-value fields
- fetch:
  - `googlePlaceId`
  - `googleMapsUrl`
  - rating
  - review count
  - phone if available
  - website if more reliable
- avoid repeated lookups once verified unless stale
- track billing-sensitive usage

When to enrich:

- no website
- no phone
- no rating
- no `googlePlaceId`
- stale `lastCheckedAt`

Success criteria:

- higher quality records at lower API cost

## Phase 8: Outreach Readiness Layer

Goal:

- rank the dataset by actual usability for business development or research

Deliverables:

- readiness score
- segmentation
- actionable exports

Score dimensions:

- official website present
- valid company email
- named decision-maker
- phone availability
- source freshness
- confidence score
- review approved

Views to add:

- ready for outreach
- needs verification
- high-value but incomplete
- recently changed

Success criteria:

- users can prioritize what to act on next

## Phase 9: Compliance And Governance

Goal:

- keep the app scalable without drifting into risky behavior

Deliverables:

- compliance policy
- retention policy
- source allowlist

Tasks:

- define what personal data can be stored
- define retention windows for contact candidates
- add source allowlist and blocklist
- add parser rules that refuse unsupported sources
- annotate records with purpose and legal basis notes where needed

Compliance fields to consider:

- `is_personal_data`
- `retention_until`
- `legal_basis_note`
- `do_not_contact`
- `restricted_source_reason`

Success criteria:

- the app can explain what it stores and why

## Phase 10: Security, Testing, And Operations

Goal:

- make the app safe to run continuously

Deliverables:

- admin auth
- test coverage
- observability

Security tasks:

- protect admin routes and import actions
- rate limit write endpoints
- validate all request payloads with Zod
- sanitize and constrain outbound fetches

Testing tasks:

- unit tests for normalization
- unit tests for merge and match logic
- integration tests for import flow
- UI smoke tests for admin, map, directory

Operational metrics:

- import duration
- fetched count
- inserted/updated/skipped ratio
- source fetch success rate
- contact extraction success rate
- review queue size
- stale record count

Success criteria:

- failures are visible
- unsafe actions are controlled
- confidence in releases improves

## API Roadmap

Add or evolve endpoints:

- `POST /imports/run` -> create job, return `202`
- `GET /imports/runs/{id}` -> detailed status
- `GET /businesses/{id}/sources`
- `GET /businesses/{id}/contacts`
- `POST /businesses/{id}/contacts/{contactId}/primary`
- `POST /businesses/{id}/review`
- `GET /review/queue`
- `POST /enrichment/run`
- `GET /search/suggestions`

API contract improvements:

- explicit enums for `enrichmentStatus`, `reviewStatus`, `contactType`
- richer filtering in `/businesses`
- support sort options by confidence, freshness, readiness

## Frontend Roadmap

### Dashboard

Improve from simple totals to operational visibility:

- import health panel
- stale data counts
- review queue counts
- contact coverage by category and city
- enrichment source coverage

### Directory

Add:

- debounce
- advanced filters
- result sorting
- bulk actions
- export current filtered view

### Map

Add:

- marker clustering
- fit-to-results
- side panel
- category chips
- confidence indicators

### Admin

Add:

- async job monitoring
- batch import launchers
- import logs
- source diagnostics
- connector health

### Review Workspace

New page:

- compare candidates and sources
- approve primary contact
- mark false positives
- attach operator notes

## Suggested Release Plan

### Release 1

- stabilize import foundation
- admin auth
- async import runs
- basic progress tracking

### Release 2

- website source fetch and parsing
- source registry
- improved filters and detail page

### Release 3

- contact candidate graph
- review queue
- better exports

### Release 4

- Google selective enrichment
- outreach readiness score
- stale recheck scheduling

### Release 5

- compliance hardening
- metrics and observability
- refinement based on operator feedback

## Immediate Next Sprint Recommendation

If we want the highest leverage next sprint after the last push, do this:

1. make imports asynchronous
2. add admin auth
3. add `business_sources`
4. create business detail page
5. fix directory UX gaps and map scaling issues

That order gives the team:

- safer operations
- clearer architecture
- visible product progress
- a clean foundation for contact research

## Definition Of Done For The App

We should consider the app mature when it can:

- ingest business records reliably
- explain the source of important fields
- identify lawful contact options
- rank confidence and readiness
- support human review for ambiguous cases
- refresh stale data incrementally
- operate with auditability and minimal compliance risk
