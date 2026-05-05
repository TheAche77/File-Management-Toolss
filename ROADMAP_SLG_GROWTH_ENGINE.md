# SLG Growth Operating System Notes

Operational notes for the Street Levels Gallery growth engine after the `2026-05-05` completion pass.

## Runtime

Required environment:

- `DATABASE_URL`
- `ADMIN_API_TOKEN`
- `PORT`
- optional `BASE_PATH`

Run migrations before deploy:

```bash
cd lib/db
drizzle-kit migrate --config ./drizzle.config.ts
```

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

- `GET /api/research/metrics` with `Authorization: Bearer $ADMIN_API_TOKEN`
- `GET /api/research/feed?targetType=buyer&warmPathExists=true`
- `GET /api/slg/offers`
- legacy `GET /api/offers`
- `GET /api/export/slg-revenue-targets.csv`
- UI routes `/`, `/businesses`, `/businesses/:id`, `/research`, `/admin`, `/offers`, `/proof`, `/accounts`, `/relationships`

## Operating Consoles

- `/` shows outreach KPIs plus SLG opportunity queues.
- `/businesses` is the canonical target directory with SLG scores and flags.
- `/businesses/:id` is the full target dossier: research state, strategic fit, offer, narrative, proof, relationship path, content snippets, CTA, outreach editor, sources, candidates, and audit events.
- `/research` is the machine console for scoring, queues, jobs, saved views, and advanced SLG filters.
- `/admin` manages protected exports and admin unlock.
