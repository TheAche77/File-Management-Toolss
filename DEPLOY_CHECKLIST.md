# Deploy Checklist

Operational checklist for promoting `crea` after the outreach merge.

## 1. Environment

Confirm these values are set before starting services:

- `DATABASE_URL`
- `PORT` for API
- `PORT` and `BASE_PATH` for frontend
- `VITE_API_PROXY_TARGET` for local frontend dev when API and Vite run on different ports

Optional:

- `LOG_LEVEL`
- `GOOGLE_MAPS_API_KEY`

Local dev default:

- API: `http://localhost:8080`
- Frontend: `http://localhost:19001`
- Vite `/api` proxy target: `http://localhost:8080`

## 2. Database Schema

For local verification, start Postgres first:

```bash
docker compose up -d postgres
```

Apply the schema update before starting the API:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/scopri_italia
pnpm --filter @workspace/db run migrate
```

This is required for:

- baseline tables on a blank local database
- outreach columns on `businesses`
- `business_sources`
- `contact_candidates`
- `outreach_events`
- research jobs and views
- SLG reference tables and scoring fields

## 3. Validation

Run validation in this order:

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/gallery-map run typecheck
```

If you have additional CI or tests in your environment, run them here before deploy.

Run the repeatable API smoke suite with the API already started:

```bash
export API_BASE_URL=http://localhost:8080/api
pnpm run smoke:slg-runtime
```

## 4. Smoke Test

Check these flows manually:

1. `/admin`
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
   - outreach timeline renders
   - outreach fields save and re-read
6. `/map`
   - map still renders
   - detail link from popup works
7. `/api/export/businesses.csv`
   - export still downloads
8. `/api/export/slg-revenue-targets.csv`
   - SLG export downloads without application-level auth
9. `/api/slg/offers` and `/api/offers`
   - both return the same seeded offer catalog shape

## 5. Known Constraints

- `GOOGLE_MAPS_API_KEY` does not unlock a full Google Places enrichment flow yet; the connector remains a stub.
- All application routes are public to anyone who can reach the deployment; use platform/network access controls when needed.
- Versioned SQL migrations now live in `lib/db/migrations`, but they still need to be applied in the real environment before startup.
- If Docker is unavailable on the host, provision any PostgreSQL 16-compatible database and use the same `DATABASE_URL` format from `.env.example`.
