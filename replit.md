# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Applications

### Gallerie d'Italia (`artifacts/gallery-map`)
A full-stack app for mapping art galleries in Italy (Rome first).

**Features:**
- Dashboard with live stats (total galleries, website coverage, phone coverage)
- Gallery directory with search, city filter, has-website filter, pagination
- Interactive Leaflet map centered on Rome with all gallery markers and popups
- Admin panel with "Import Rome from OSM" button, import history, CSV export

**Backend API endpoints:**
- `GET /api/healthz` — health check
- `GET /api/galleries` — list galleries (search, city, hasWebsite, hasPhone, source, page, pageSize)
- `GET /api/galleries/:id` — single gallery
- `GET /api/stats` — dashboard statistics
- `POST /api/imports/osm/rome` — trigger OSM import for Rome
- `GET /api/import-runs` — import run history
- `GET /api/export/galleries.csv` — CSV export

**Data sources:**
- OpenStreetMap Overpass API — tags: tourism=gallery, shop=art, amenity=arts_centre
- Optional: Google Places API enrichment (set GOOGLE_MAPS_API_KEY secret)

**DB tables:** `galleries`, `import_runs`

**Services:**
- `overpassService.ts` — fetches from Overpass API with retry/timeout
- `galleryNormalizer.ts` — normalizes OSM elements to DB schema
- `dedupeService.ts` — deduplication by osm_id, coords+name, website, phone
- `importService.ts` — orchestrates full import flow with run tracking
