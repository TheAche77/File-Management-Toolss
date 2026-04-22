# Scopri Italia

Local business discovery and enrichment platform for Italy.

The app is built as a `pnpm` monorepo with:

- `artifacts/api-server`: Express API
- `artifacts/gallery-map`: React frontend
- `lib/db`: Drizzle schema and database client
- `lib/api-spec`: OpenAPI source of truth
- `lib/api-client-react`: generated React Query hooks

## What It Does

The current branch supports:

- category and city based business discovery
- async imports from OpenStreetMap Overpass
- bulk-aware merge and dedupe
- source tracking with `business_sources`
- review queue for incomplete or suspicious records
- contact candidates with manual review actions
- generic email extraction from official websites only
- minimal admin protection via `ADMIN_API_TOKEN`
- business detail pages with sources, contact candidates, and outreach editing
- outreach KPI dashboard and follow-up pipeline board
- outreach audit timeline per business
- versioned SQL migrations in `lib/db/migrations`

The enrichment model is intentionally conservative:

- official websites and official website pages are allowed
- generic business emails such as `info@`, `contact@`, `hello@` are allowed
- personal LinkedIn scraping is not part of the product

## Workspace Layout

| Path | Purpose |
|---|---|
| `artifacts/api-server` | Express API, import pipeline, enrichment services |
| `artifacts/gallery-map` | React UI, dashboard, directory, map, admin |
| `lib/db` | Drizzle schema and DB client |
| `lib/api-spec` | OpenAPI spec used for generated clients |
| `lib/api-client-react` | generated API hooks used by the frontend |

## Environment Variables

Copy `.env.example` and adapt it to your environment.

Required for the API:

- `PORT`
- `DATABASE_URL`

Recommended for production-like local use:

- `ADMIN_API_TOKEN`
- `LOG_LEVEL`

Optional:

- `GOOGLE_MAPS_API_KEY`

Required for the frontend:

- `PORT`
- `BASE_PATH`

Notes:

- `ADMIN_API_TOKEN` protects import, review queue, contact candidate review, and import history endpoints.
- `ADMIN_API_TOKEN` is now required for API startup. The server fails fast if it is missing.
- `BASE_PATH` must match the Vite base path expected by the frontend. In a simple local setup, `/` is usually fine.

## GitHub Token Rotation

The `GITHUB_SSH_KEY` secret holds a fine-grained GitHub PAT scoped to this repository. It should be rotated every **90 days**.

The expiry date is tracked in the `GITHUB_TOKEN_EXPIRY` environment variable (format `YYYY-MM-DD`). `scripts/restore-ssh-key.sh` checks this date on every post-merge run and prints a warning 14 days before expiry or an error once expired.

**To rotate the token:**

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Generate a new token scoped to this repository with **Contents: Read and write** permission and set its expiry to 90 days from today
3. Update the `GITHUB_SSH_KEY` secret in **Replit Secrets** with the new token value
4. Update the `GITHUB_TOKEN_EXPIRY` environment variable in **Replit** to the new expiry date

To make an expired token cause the post-merge script to abort (instead of just warning), set `ENFORCE_GITHUB_TOKEN_EXPIRY=true` in environment variables.

## Example Local Setup

API shell:

```bash
export PORT=8080
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/scopri_italia
export ADMIN_API_TOKEN=change-me-to-a-long-random-string
export LOG_LEVEL=info
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

Frontend shell:

```bash
export PORT=19001
export BASE_PATH=/
pnpm --filter @workspace/gallery-map run dev
```

## Main Commands

Typecheck:

```bash
pnpm run typecheck
```

Typecheck specific packages:

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/gallery-map run typecheck
```

Build API:

```bash
pnpm --filter @workspace/api-server run build
```

Run frontend:

```bash
pnpm --filter @workspace/gallery-map run dev
```

Regenerate API client after changing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-client-react run codegen
```

Run versioned database migrations:

```bash
pnpm --filter @workspace/db run migrate
```

## Current Data Model

Core tables in active use:

- `categories`
- `businesses`
- `import_runs`
- `business_sources`
- `contact_candidates`
- `outreach_events`

Important functional roles:

- `businesses`: canonical business record
- `business_sources`: provenance and fetch tracking for source URLs
- `contact_candidates`: suggested contact paths with confidence and review state
- `outreach_events`: audit trail for outreach edits and contact candidate review actions

## Protected Admin Features

When `ADMIN_API_TOKEN` is configured:

- open `/admin`
- paste the token into the unlock form
- the token is stored in `sessionStorage` for the current browser session only
- protected API calls are sent with `Authorization: Bearer <token>`

Protected capabilities currently include:

- run imports
- read import history
- read review queue
- read contact candidates
- approve/reject/set-primary contact candidates
- read and edit outreach fields
- read outreach dashboard and pipeline data

## Data Flow

1. Admin queues an import.
2. The API fetches raw business candidates from Overpass.
3. Records are normalized and merged in bulk.
4. `business_sources` are recorded for provenance.
5. Base `contact_candidates` are created from known official channels.
6. Official website pages are fetched conservatively to extract generic emails.
7. Operators review candidates in the admin/detail workflow.

## Legal / Product Guardrails

The intended operating model is:

- use official business sources first
- keep provenance for every derived contact path
- avoid aggressive scraping
- avoid collecting unnecessary personal data
- send doubtful records to review instead of treating them as truth

Not in scope:

- automated LinkedIn profile scraping
- mass collection of personal third-party profile data
- guessing personal emails from names/domains

## Operational Notes

- The Google Places connector is still a stub even if `GOOGLE_MAPS_API_KEY` is present.
- The current environment here did not allow running `pnpm`/`npm`, so recent changes were implemented and reviewed but not compiled in this session.
- Any schema additions such as `business_sources`, `contact_candidates`, or `outreach_events` require the corresponding database migration in your real environment.
- The optimization audit and phased fix plan lives in [OPTIMIZATION_AUDIT.md](./OPTIMIZATION_AUDIT.md).

## Post-Merge Rollout

After promoting the outreach branch into `crea`, run the backend migrations before starting the apps:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/scopri_italia
pnpm --filter @workspace/db run migrate
```

Recommended local validation order:

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/gallery-map run typecheck
```

Smoke test checklist:

1. Unlock `/admin` with `ADMIN_API_TOKEN`.
2. Open `/` and verify the outreach KPI dashboard loads.
3. Open `/pipeline` and verify urgency buckets render.
4. Open `/businesses/:id` from the directory and verify:
   - sources load
   - contact candidates load
   - outreach timeline loads
   - outreach fields save and re-read
5. Queue an import and verify import history/progress still works.
6. Verify directory, map, and CSV export still behave as before.

## Roadmap

The higher-level product and engineering roadmap lives in:

- [ROADMAP.md](./ROADMAP.md)
- [ROADMAP_SLG_OUTREACH.md](./ROADMAP_SLG_OUTREACH.md)
