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
cd lib/api-spec
./node_modules/.bin/orval --config ./orval.config.ts
```

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
