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
