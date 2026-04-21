# Scopri Italia — Local Business Discovery Engine

## Overview

Multi-category local business discovery engine for Italy. Uses OpenStreetMap Overpass API as the primary data source, with optional Google Places enrichment. Supports 7 business categories across major Italian cities. Deployed as a pnpm monorepo with a React frontend and Express API.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Map**: Leaflet via react-leaflet
- **Data source**: OpenStreetMap Overpass API

## Packages

| Package | Purpose |
|---|---|
| `artifacts/api-server` | Express API server (port 8080) |
| `artifacts/gallery-map` | React frontend (Vite, port 19001) |
| `lib/db` | Drizzle schema, db client |
| `lib/api-spec` | OpenAPI spec (`openapi.yaml`) |
| `lib/api-client-react` | Generated React Query hooks (Orval) |

## Key Commands

```bash
# Typecheck
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/gallery-map run typecheck

# Build API
pnpm --filter @workspace/api-server run build

# Regenerate API client from openapi.yaml
pnpm --filter @workspace/api-client-react run codegen

# DB: run raw SQL via executeSql (drizzle-kit push has interactive prompts)
```

## Database Schema

Tables: `categories`, `businesses`, `import_runs`, `galleries` (legacy, orphaned)

### categories
- `id`, `slug` (unique), `label`, `description`, `osm_tags`, `active`
- Seeded with 7 categories: art_gallery, museum, restaurant, hotel, bookstore, coworking, event_venue

### businesses
- `id`, `category_slug`, `name`, `slug`, `latitude`, `longitude`
- `address_line`, `city`, `postal_code`, `region`, `country`
- `website`, `phone`, `osm_id`, `osm_type`, `google_place_id`, `google_maps_url`
- `rating`, `user_ratings_total`, `has_website`, `has_phone`, `enrichment_status`
- Unique constraint on `(slug, category_slug)`

### import_runs
- `id`, `category_slug`, `city`, `source`, `status`, `fetched`, `inserted`, `updated`, `errors`, `skipped`

## Connector Architecture

Located in `artifacts/api-server/src/connectors/`:
- `types.ts` — `Connector` interface, `CITY_BBOXES` (rome, milan, florence, naples, venice)
- `overpassConnector.ts` — OSM Overpass API connector with multi-tag support
- `googlePlacesConnector.ts` — Google Places stub (gated on `GOOGLE_MAPS_API_KEY`)

## API Endpoints

- `GET /api/healthz` — Health check
- `GET /api/categories` — List all categories
- `GET /api/businesses` — Paginated business list (filters: categorySlug, city, search, hasWebsite)
- `GET /api/stats` — Dashboard stats (totalBusinesses, withWebsite, withPhone, enriched, breakdowns)
- `POST /api/imports/run` — Run OSM import `{ categorySlug, city }`
- `GET /api/imports/runs` — Import run history
- `GET /api/exports/businesses.csv` — CSV export

## Frontend Pages

- `/` — Dashboard with KPI cards and category/city breakdowns
- `/businesses` — Directory with search, category filter, city filter, website filter
- `/map` — Leaflet map of all businesses
- `/admin` — Import controls (select category + city, run import) + export + history

## Data Flow

1. Admin triggers import → `POST /api/imports/run`
2. `importOrchestrator` fetches from OverpassConnector using OSM tags from `categories` table
3. Records are deduped via `dedupeService` (OSM ID + slug-based)
4. Upserted into `businesses` table
5. Frontend queries via generated React Query hooks

## Known Issues

- City names may appear as both "Rome" and "Roma" (OSM returns Italian names). Normalization can be added to `importOrchestrator.ts`.
- Google Places connector is a stub — requires `GOOGLE_MAPS_API_KEY` secret to activate.
- `galleries` table still exists in the DB (80 legacy rows, data migrated to `businesses`).
