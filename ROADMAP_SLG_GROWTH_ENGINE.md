# SLG Growth Operating System Notes

Operational notes for the Street Levels Gallery growth engine after the `2026-05-05` completion pass.

## Runtime

Required environment:

- `DATABASE_URL`
- `ADMIN_API_TOKEN`
- `PORT`
- optional `BASE_PATH`
- optional `VITE_API_PROXY_TARGET` for frontend dev proxying; default is `http://localhost:8080`

Start local Postgres when Docker is available:

```bash
docker compose up -d postgres
```

Start local Postgres without Docker on macOS:

```bash
brew install postgresql@16
brew services start postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
createdb scopri_italia
export DATABASE_URL=postgres://$(whoami)@localhost:5432/scopri_italia
```

Confirm the Homebrew runtime gate before running DB-bound enrichment:

```bash
psql --version
pg_isready
printenv DATABASE_URL
```

Run migrations before deploy:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/scopri_italia
pnpm --filter @workspace/db run migrate
```

The migration chain includes `0000_base_schema.sql`, so a blank local Postgres database can be migrated without relying on pre-existing `businesses`, `business_sources`, or `contact_candidates` tables.

## Verification

Use the repository-local binaries if `pnpm` is unavailable on PATH:

```bash
./node_modules/.bin/tsc --build
/Users/streetlevelsgallery/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node artifacts/api-server/build.mjs
PATH=/Users/streetlevelsgallery/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH artifacts/gallery-map/node_modules/.bin/vite build --config artifacts/gallery-map/vite.config.ts
git diff --check
```

Regenerate contracts after OpenAPI edits:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Legal Enrichment

The enrichment layer is intentionally conservative. The current implemented external connector is Wikidata.

Required env:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/scopri_italia
export SLG_USER_AGENT="StreetLevelDiscovery/1.0 (https://github.com/TheAche77/File-Management-Toolss)"
```

Commands:

```bash
pnpm run enrich:pending -- --limit 25
pnpm run enrich:business -- --id <business_id>
pnpm run enrich:source -- --source wikidata --limit 50
```

Real DB verification sequence:

```bash
export DATABASE_URL=postgres://$(whoami)@localhost:5432/scopri_italia
pnpm run verify:wikidata-enrichment
```

Check `businesses.wikidata_id`, `businesses.last_enrichment_at`, `businesses.data_quality_score`, `businesses.enrichment_source_count`, and a `business_sources.source_type = 'wikidata_entity'` row. Re-running the same business should not duplicate the source row.

`data_quality_score` is deterministic and currently uses: website `+20`, phone `+15`, OSM ID `+15`, Wikidata ID `+20`, GeoNames ID `+10`, two or more source records `+10`, capped at `100`.

Source policy:

- OSM/Overpass: active, bounded city/bbox imports.
- Wikidata: active, exact-label/entity enrichment with cache/rate limit and CC0 provenance.
- Overture Maps: future bounded GeoParquet/DuckDB workflow only; no global ingest.
- GeoNames: future city/admin normalization from CC-BY dumps.
- OpenCorporates: disabled unless an API account/token and allowed limits are explicitly configured.
- EU/local open data: future dataset-specific plugins only.

GeoNames gate:

- Do not implement GeoNames until `pnpm run verify:wikidata-enrichment` passes on real Postgres.
- GeoNames must use `cities15000.zip` or another static dump; no live API calls.
- Planned commands are `pnpm run geo:import-cities -- --file data/cities15000.zip` and `pnpm run enrich:all -- --limit 1000 --source both`.

## Smoke Tests

With API and DB running, verify:

- automated API smoke test:

```bash
export API_BASE_URL=http://localhost:8080/api
export ADMIN_API_TOKEN=replace-with-a-long-random-admin-token
pnpm run smoke:slg-runtime
```

The smoke test covers admin auth, research endpoints, `/api/slg/*`, legacy SLG aliases, CSV exports, and expected default SLG reference data.

Manual UI smoke test:

- UI routes `/`, `/businesses`, `/businesses/:id`, `/research`, `/admin`, `/offers`, `/proof`, `/accounts`, `/relationships`
- In local development, run the API on `8080` and the frontend on `19001`; Vite proxies frontend `/api` requests to `VITE_API_PROXY_TARGET`.

## Operating Consoles

- `/` shows outreach KPIs plus SLG opportunity queues.
- `/businesses` is the canonical target directory with SLG scores and flags.
- `/businesses/:id` is the full target dossier: research state, strategic fit, offer, narrative, proof, relationship path, content snippets, CTA, outreach editor, sources, candidates, and audit events.
- `/research` is the machine console for scoring, queues, jobs, saved views, and advanced SLG filters.
- `/admin` manages protected exports and admin unlock.
