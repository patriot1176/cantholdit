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

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

## App: Can't Hold It (`artifacts/cant-hold-it`)

Community-rated restroom and rest stop finder for US road trippers. Tagline: "Because nature doesn't wait."

### Features
- **Map view**: Leaflet.js + `leaflet.markercluster` for clustered 🚽 pins, color-coded by rating (green ≥4.0, amber 3.0–3.9, red <3.0, gray unrated). Blue number clusters collapse dense areas. Filter chips affect map markers. Route polyline overlay drawn when route search is active.
- **List view**: Card list sorted nearest-first (GPS sort even without explicit search). Shows verified badge (CheckCircle) for stops with 10+ ratings. Horizontal filter chips for type + minimum rating.
- **Route search (Route tab)**: Enter start + end city → Nominatim geocodes both → OSRM driving route → filters stops within 15 miles of polyline. Shows results as list + draws route on map with blue polyline. "View on Map" button switches to map view showing the route.
- **Leaderboard (Top view)**: Royal Flush (top 5 ≥4.0) + Biohazard Zone (worst 5) derived from all stops.
- **Search**: Nominatim geocoding with disambiguation dropdown. "Find Near Me" GPS crosshair. 300km proximity radius. `skipGeocodeRef` prevents "Near me" text from geocoding.
- **Stop Detail**: Share button (Web Share API + clipboard fallback), verified badge (10+ ratings), photo gallery with upload (object storage), Get Directions (Google Maps), Flush Breakdown grid, Reviews.
- **Amenity tags (Stop Detail)**: 12 tap-to-toggle amenity chips (♿ Accessible, 👶 Baby Changing, 🚿 Shower, etc.). Community-toggled via PATCH /stops/:id/amenities. Optimistic UI.
- **Report a problem (Stop Detail)**: Flag button opens bottom-sheet modal with 5 report types (permanently closed, temporarily closed, wrong location, wrong info, other) + optional comment. Submitted via POST /stops/:id/report.
- **Quick-rate prompt**: After viewing a stop detail, sessionStorage saves the stop. On returning to home screen a floating banner appears: "Just visited? [Name] — Rate it" button. Dismissed on tap or X.
- **Filter chips**: Type (All/Rest Area/Gas/Truck/Food) + rating (Any/3★+/4★+) chips. Shown in map + list views.
- **Photo uploads**: File input → POST `/api/storage/uploads/request-url` → PUT presigned URL → POST `/api/stops/:id/photos`. Stored in Replit object storage.
- **Add Stop**: Form to contribute new restroom locations.
- **Rating form**: 6-category flush rating (cleanliness, odor, TP supply, lighting, safety, family-friendly).

### API Routes
- `GET /api/stops` — list all stops with aggregate ratings, badges, amenities
- `GET /api/stops/:id` — single stop detail (includes amenities)
- `POST /api/stops` — add new stop
- `PATCH /api/stops/:id/amenities` — community update amenities list
- `POST /api/stops/:id/report` — submit a problem report
- `GET /api/stops/:id/ratings` — reviews for a stop
- `POST /api/stops/:id/ratings` — submit a rating
- `GET /api/stops/:id/photos` — photo list (with `/api/storage` URL prefix)
- `POST /api/stops/:id/photos` — save objectPath after upload
- `POST /api/storage/uploads/request-url` — request presigned upload URL
- `GET /api/storage/objects/*` — serve private objects via ACL check
- `GET /api/storage/public-objects/*` — serve public objects unconditionally

### DB Schema
- `stops` — name, type, lat/lng, address, notes, amenities (JSON text array, default '[]')
- `ratings` — 6 numeric columns + comment, FK to stops
- `photos` — objectPath, FK to stops (cascade delete)
- `stop_reports` — reportType enum (permanently_closed/temporarily_closed/wrong_location/wrong_info/other), optional comment, FK to stops

### Admin Seed Endpoint (HIFLD Import)

`POST /api/admin/seed-rest-areas?key=<ADMIN_SEED_KEY>`

One-time import of ~1,500 US Interstate rest areas from the HIFLD federal dataset (FHWA/US DOT).

**Usage after deploying:**
```
curl -X POST "https://your-app.replit.app/api/admin/seed-rest-areas?key=cant-hold-it-seed"
```

- Protected by `ADMIN_SEED_KEY` env var (default: `cant-hold-it-seed`) — set a stronger key in production via Secrets
- Skips stops already within 0.01° of an existing rest_area (safe to re-run)
- Returns JSON: `{ inserted, skipped, hifldTotal, filtered }`
- File: `artifacts/api-server/src/routes/admin.ts`

### Key Implementation Notes
- Pin colors are hardcoded hex — CSS variables don't work in Leaflet `divIcon` HTML
- `leaflet.markercluster` used as `(L as any).markerClusterGroup(...)` to avoid TS type noise
- Verified badge threshold: `totalRatings >= 10`
- Object storage bucket: `replit-objstore-9754dfda-2cc6-429c-9885-c90347453f32`
- Seed data: 32 real US stops across Iowa 80, Buc-ee's (9 locations), Love's, Flying J, Pilot, QuikTrip, Wawa, Sheetz, NJ Turnpike, WA/OR/CA/CO/UT/NM rest areas
- `lib/api-zod/src/storage.ts` — `RequestUploadUrlBody` + `RequestUploadUrlResponse` Zod schemas (not generated by Orval)
