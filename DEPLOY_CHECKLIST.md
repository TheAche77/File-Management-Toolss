# Deploy Checklist

Operational checklist for promoting `crea` after the outreach merge.

## 1. Environment

Confirm these values are set before starting services:

- `DATABASE_URL`
- `ADMIN_API_TOKEN`
- `PORT` for API
- `PORT` and `BASE_PATH` for frontend

Optional:

- `LOG_LEVEL`
- `GOOGLE_MAPS_API_KEY`

## 2. Database Schema

Apply the schema update before starting the API:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/scopri_italia
pnpm --filter @workspace/db run push
```

This is required for:

- outreach columns on `businesses`
- `business_sources`
- `contact_candidates`

## 3. Validation

Run validation in this order:

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/gallery-map run typecheck
```

If you have additional CI or tests in your environment, run them here before deploy.

## 4. Smoke Test

Check these flows manually:

1. `/admin`
   - unlock with `ADMIN_API_TOKEN`
   - queue an import
   - verify import history loads
2. `/`
   - outreach KPI dashboard loads
   - urgent-this-week cards render
3. `/pipeline`
   - urgent / this week / next buckets render
   - email template button appears when `contactEmail` exists
4. `/businesses`
   - directory still loads
   - detail links work
5. `/businesses/:id`
   - overview loads
   - tracked sources render
   - contact candidates render
   - outreach fields save and re-read
6. `/map`
   - map still renders
   - detail link from popup works
7. `/api/export/businesses.csv`
   - export still downloads

## 5. Known Constraints

- `GOOGLE_MAPS_API_KEY` does not unlock a full Google Places enrichment flow yet; the connector remains a stub.
- Admin-protected flows depend on `ADMIN_API_TOKEN`; the API now fails fast at startup if it is missing.
- This repo currently relies on schema push in the real environment rather than checked-in formal SQL migrations.

## 6. Replit-Specific Notes

### Secrets

`ADMIN_API_TOKEN` must be set as a **Replit Secret**, not a plain environment variable. Setting it as an env var writes the value into `.replit`, which is committed to git.

`DATABASE_URL` is injected automatically by the Replit `postgresql-16` module — do not set it manually unless overriding.

### Schema push

There is no migrations folder. Use drizzle-kit push to sync the schema:

```bash
pnpm --filter @workspace/db run push
```

Run this before the first API start and after any schema changes. The `scripts/post-merge.sh` script runs this automatically after task merges.

### Service ports

| Service | Local port | Replit external |
|---|---|---|
| API server | 8080 | 8080 |
| React frontend | 19001 | 3000 |

Both services start automatically when you click **Run**.

### Smoke test URLs (Replit)

- `/api/healthz` — health check
- `/` — dashboard
- `/businesses` — directory
- `/pipeline` — follow-up board
- `/admin` — admin panel (requires `ADMIN_API_TOKEN`)
- `/map` — map view

### GeoNames file

`data/cities15000.txt` is not committed. Upload it manually to the workspace if GeoNames local enrichment is needed.
