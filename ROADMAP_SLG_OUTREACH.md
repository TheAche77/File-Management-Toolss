# SLG Outreach Implementation Roadmap

This document turns the latest strategic proposals into an implementation plan for the existing codebase.

It is intentionally pragmatic:

- keep the current architecture: Express + Drizzle + React
- prioritize replacing spreadsheet workflows with productized flows
- stay inside a legally defensible, free-first operating model
- avoid adding speculative integrations before the core outreach workflow is stable

## Scope

This roadmap covers the following requested directions:

1. turn `businesses` into a real outreach pipeline
2. remap generic categories into SLG outreach avatars and target markets
3. replace generic dashboard KPIs with outreach KPIs
4. add an automated follow-up board
5. add artist-market assignment logic and suggestion rules

It also incorporates the explicit constraints:

- do not rewrite the current architecture
- do not spend time on Google Places until a real API key exists
- do not expand into 12 commercial categories yet
- focus on the current target list and outreach operating system first

## Current Baseline

The branch already has:

- async imports
- source tracking
- business detail pages
- review queue
- contact candidates
- generic email enrichment from official websites
- manual review actions for contact candidates
- minimal admin token protection

What is still missing for outreach operations:

- first-class outreach fields and statuses
- relationship between target type and suggested artist
- follow-up workflow and board
- KPI dashboard aligned with sales/outreach reality
- EU city coverage aligned with actual SLG targets

## Product Goal

Move from:

- discovery and enrichment tool

to:

- discovery + qualification + outreach operating system

so that the browser replaces the spreadsheet as the day-to-day workspace.

## Non-Negotiable Principles

- `businesses` remains the canonical operating record until there is a proven need to split CRM entities.
- all contact and outreach actions stay traceable and queryable.
- named-person contact data remains reviewable and minimally collected.
- official websites, public registries, and public structured sources remain the preferred sources.
- cold data discovery is secondary to operational clarity on the targets already in hand.

## Target Outcome

At the end of this roadmap, an operator should be able to:

1. import or curate target businesses
2. assign each target to an SLG avatar and artist
3. see who needs contact this week
4. record where each target sits in the outreach pipeline
5. review contact candidates and choose the primary one
6. work from one browser workflow instead of Excel

## Delivery Strategy

Implementation should be split into 6 phases.

Why this order:

- first make the data model support outreach
- then reshape categorization and targeting
- then surface operational views
- then add automation and suggestions
- only after that consider broader intelligence connectors

## Phase 1: Outreach Data Model

### Goal

Extend `businesses` so it can act as the operational outreach record.

### Why First

Without this, every other workflow still leaks back into Excel.

### DB Changes

Add these columns to `businesses`:

- `outreach_status`
- `contact_name`
- `contact_role`
- `contact_email`
- `last_contact_date`
- `next_action_date`
- `assigned_artist`
- `avatar_type`
- `target_market`
- `notes`
- `warm_connection`

Suggested defaults:

- `outreach_status = 'not_contacted'`
- `target_market = 'IT'` only where explicitly known, otherwise null is safer

Suggested enum-like values:

`outreach_status`

- `not_contacted`
- `emailed`
- `follow_up_1`
- `follow_up_2`
- `interested`
- `closed_won`
- `closed_lost`

`avatar_type`

- `gallery_director`
- `hotel_art_curator`
- `festival`
- `museum_shop`
- `institution`

`assigned_artist`

- `Ache77`
- `Exit Enter`
- `Nian`
- `Kraita317`

`target_market`

- `IT`
- `UK`
- `NL`
- `FR`
- `ES`
- `PT`
- `RO`
- keep nullable for unknown markets instead of forcing a guess

### Backend Work

- add schema fields in Drizzle
- expose fields in serialization
- add update endpoint for outreach fields
- validate allowed status values server-side
- compute `next_action_date` via service logic, not only UI logic

### Frontend Work

- show outreach summary on business detail page
- add editable outreach form in admin-capable UI
- support notes and warm connection editing

### Acceptance Criteria

- an operator can stop using Excel for the current core fields
- each business can store outreach state, owner, contact, and next action

## Phase 2: SLG Category And Targeting Model

### Goal

Align discovery categories with actual SLG outreach avatars.

### Why Second

If outreach is the real workflow, generic categories are no longer enough.

### Category Changes

Map current discovery intent to SLG-focused categories:

| Avatar | New slug | Discovery direction |
|---|---|---|
| Gallery Director | `urban_art_gallery` | art galleries and adjacent art-commerce venues |
| Hotel Art Curator | `design_boutique_hotel` | hotels with design and cultural positioning |
| Museum Shop Buyer | `art_museum` | museums and arts centres |
| Festival / Institution | `cultural_institute` | arts centres, institutions, diplomatic or cultural nodes |

### Connector Changes

- update `categories` seeds to include SLG categories
- keep old categories only if needed for compatibility/migration
- extend `CITY_BBOXES` to:
  - `london`
  - `amsterdam`
  - `paris`
  - `barcelona`
- preserve current Italian cities

### Important Constraint

Do not overfit OSM alone.

The category layer should support:

- source acquisition category
- outreach avatar

These are related but not identical.

In practice:

- the import category can remain discovery-oriented
- `avatar_type` becomes the operational outreach classification

### Recommended Implementation Detail

Do not make `avatar_type` purely inferred forever.

Use:

- initial suggestion from category/source rules
- manual override in UI

### Acceptance Criteria

- imported targets from Italy and selected EU cities can be classified into an SLG avatar without Excel
- category and avatar no longer drift apart silently

## Phase 3: KPI Dashboard Rebuild

### Goal

Replace discovery KPIs with outreach KPIs.

### Why Third

Once outreach data exists, the dashboard should reflect actual operating performance.

### Replace Current KPIs With

Top-level cards:

- `Contacted`
- `Positive Responses`
- `Response Rate`
- `Overdue Follow-ups`
- `In Progress`
- `Interested`

### Supporting Views

- urgent this week
- by artist
- by avatar type
- by market
- by outreach status

### Backend Work

Add a stats endpoint or extend the current stats endpoint with outreach metrics:

- `contactedCount`
- `positiveCount`
- `responseRate`
- `overdueCount`
- `inProgressCount`
- `interestedCount`

Recommended definitions:

- `contactedCount`: any target with status not equal to `not_contacted`
- `positiveCount`: status `interested` or `closed_won`
- `inProgressCount`: `emailed`, `follow_up_1`, `follow_up_2`
- `overdueCount`: `next_action_date < today` and not closed

### Frontend Work

- replace generic dashboard cards
- add “urgent this week” section
- add direct links to target detail or pipeline board

### Acceptance Criteria

- dashboard answers operational outreach questions in one glance
- no one needs the spreadsheet to know what matters this week

## Phase 4: Follow-Up Board

### Goal

Create a dedicated board for action timing.

### Why Fourth

This is the daily execution layer once statuses and dates exist.

### Page

Add `/pipeline`.

### Core Logic

Show only records where:

- `next_action_date <= today + 3 days`

Recommended buckets:

- `Urgent`
- `This Week`
- `Next`

Possible calculation:

- `Urgent`: overdue or due today
- `This Week`: due in 1-3 days
- `Next`: due in 4-7 days

### Card Content

Each card should show:

- business name
- avatar type
- assigned artist
- current outreach status
- next action date
- latest contact path
- warm connection, if any

### Interaction

- open business detail
- mark next step complete
- change outreach status
- set new next action date
- open the email template anchor for the current avatar/touchpoint

### Recommended Technical Shape

Do not start with drag-and-drop.

Start with:

- fast filters
- grouped lists
- explicit action buttons

Drag-and-drop can come later if needed.

### Acceptance Criteria

- the operator can work the next 7 days of outreach from one page
- overdue actions are visible immediately

## Phase 5: Artist × Target Recommendation Layer

### Goal

Suggest the best artist for a target based on market and avatar fit.

### Why Fifth

This is valuable once the team can already operate the pipeline.

### Suggestion Matrix

Encode the current matrix as rule-based logic first:

`Ache77`

- markets: `IT`, `RO`, `UK`, `NL`
- strong fit: galleries, festivals, institutions

`Exit Enter`

- markets: `NL`, `UK`, `USA`
- strong fit: urban art galleries, museum shop, hotel design

`Nian`

- markets: Eastern Europe, `FR`, Scandinavian region
- strong fit: non-profit, festival, alternative galleries

`Kraita317`

- markets: `IT`, `ES`, `PT`
- strong fit: boutique hotel, contemporary galleries

### Implementation

Start with a pure service function:

- input:
  - `avatar_type`
  - `target_market`
  - optional category/source cues
- output:
  - `suggestedArtist`
  - `confidence`
  - `reason`

### UI

In creation/edit flows:

- auto-suggest `assigned_artist`
- allow manual override
- show short rationale

### Acceptance Criteria

- new records get useful artist suggestions automatically
- manual overrides remain possible and explicit

## Phase 6: Free-First Research Optimizations

### Goal

Improve target quality without depending on paid third parties.

### Why Last

Because a better data engine is less urgent than a working outreach operating system.

### In-Scope Optimizations

#### 1. Better OSM field extraction

Extend Overpass extraction to capture more already-public tags when present:

- `email`
- `contact:email`
- `contact:instagram`
- `contact:facebook`
- `contact:linkedin`
- `opening_hours`
- `description`
- `operator`

#### 2. `mailto:` and structured HTML extraction

Upgrade official website parsing to extract:

- `mailto:` links
- HTML anchors for contact buttons
- JSON-LD fields such as:
  - `email`
  - `telephone`
  - `sameAs`
  - `address`

#### 3. Public registry-compatible connectors

Plan, but do not necessarily implement all at once:

- Companies House for UK
- official company registries where terms clearly allow the use

Use them for:

- legal entity name
- named director/administrator
- not for aggressive harvesting

#### 4. Intent signals, later not now

Keep as planned future work:

- open calls
- new openings
- institutional announcements

But do not make this a blocker for replacing Excel.

### Acceptance Criteria

- free public sources improve completeness of the existing targets
- the team does not need a paid enrichment vendor to run the first real workflow

## Recommended Order Of Execution

This is the concrete implementation order, highest leverage first:

1. outreach fields on `businesses`
2. business detail and edit form for outreach fields
3. outreach KPI dashboard
4. `/pipeline` follow-up board
5. SLG category and avatar remapping
6. artist suggestion service
7. free-first source extraction improvements

## What Not To Do Yet

- do not build a large separate CRM subsystem
- do not add Google Places work until a real key exists
- do not introduce all 12 commercial categories
- do not optimize intent-signal ingestion before daily outreach execution is stable
- do not overcomplicate assignment with ML before simple rule-based suggestions are in place

## Delivery Plan By Sprint

### Sprint A

- DB migration for outreach fields
- backend update endpoint
- business detail edit form

Outcome:

- spreadsheet replacement starts immediately

### Sprint B

- outreach KPI stats
- new dashboard cards
- urgent-this-week list

Outcome:

- leadership view becomes meaningful

### Sprint C

- `/pipeline` page
- next action filters and buckets
- quick actions for status/date updates

Outcome:

- team gets a daily operating board

### Sprint D

- SLG category remap
- EU city bbox additions
- avatar suggestion defaults

Outcome:

- target acquisition aligns with actual outreach personas

### Sprint E

- artist suggestion matrix
- rationale in UI
- manual override tracking

Outcome:

- assignment becomes faster and more consistent

### Sprint F

- better OSM extraction
- HTML/JSON-LD improvements
- optional public-registry experiments

Outcome:

- target completeness improves without paying vendors

## Success Metrics

The roadmap is successful when:

- the spreadsheet is no longer needed for current outreach operations
- every target has an outreach state and next action path
- dashboard reflects actual outreach performance
- operators can run weekly follow-up from `/pipeline`
- artist assignment is suggested automatically for most new targets
- free public data improvements increase completeness without breaking legal guardrails

## Decision Notes

### Why keep outreach fields on `businesses` first

Because the team needs one operating object now, not an ideal future CRM model.

If later needed, `businesses` can be split into:

- target account
- contact
- outreach sequence

But that would be premature today.

### Why not prioritize deeper contact mining first

Because finding more contacts does not solve the workflow problem if:

- statuses are still externalized
- follow-ups are still manual
- next action timing is not operationalized

### Why not build intent signals first

Because a signal is only useful when the system already knows:

- who owns the target
- which artist fits
- what the next outreach step should be

## Suggested Next Build Step

If implementation starts immediately, begin with:

- `Phase 1` plus the minimal `/pipeline` backend primitives

That gives the fastest path to:

- getting out of Excel
- making follow-up visible
- making the current 91 targets operational
