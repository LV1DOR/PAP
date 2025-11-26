# Development Log

Each change is documented with WHAT and WHY in simple terms.

## 2025-11-21 - Initial Scaffold
**WHAT:** Created minimal Next.js project files: `package.json`, `next.config.mjs`, `app/layout.js`, `app/page.js`, `.gitignore`, and `README.md`.
**WHY:** Establish a clean JavaScript-only foundation so we can add styling, database connections, and features gradually without complexity.

## 2025-11-21 - Added Tailwind CSS
**WHAT:** Added `tailwind.config.js`, `postcss.config.js`, `styles/globals.css`; updated `package.json` dev dependencies; imported stylesheet in `app/layout.js` and replaced inline styles with Tailwind utility classes.
**WHY:** Tailwind speeds up consistent styling and layout. Doing it early prevents restyling later and prepares for shadcn/ui integration.

## 2025-11-25 - Added shadcn/ui Components
**WHAT:** Created `components.json` config, added `lib/utils.js` helper, built Button and Card components in `components/ui/`, added CSS variables for theming, configured path aliases in `next.config.mjs`, updated `app/page.js` to demo components.
**WHY:** shadcn/ui gives us pre-built, accessible, customizable UI components. This saves time and ensures consistency across forms, dashboards, and dialogs throughout the app.

## 2025-11-25 - Supabase Client Setup (Phase 1)
**WHAT:** Added `lib/supabase/client.js` exporting a singleton Supabase client; created `.env.example` for required environment variables (public URL & anon key plus future service role, email, Sentry). Warns if env vars missing. Ready for auth & data phases.
**WHY:** Establishes backend connectivity foundation early so upcoming auth, reports CRUD, and realtime features can use a consistent client without refactoring.

## 2025-11-25 - Database Schema (Phase 2)
**WHAT:** Created `scripts/schema.sql` with complete PostgreSQL schema: users, categories, reports, report_images, audit_logs tables; enums for roles/status/priority; indexes on status, dates, category, location; RLS policies for citizen/staff/admin access control; triggers for auto-updating timestamps; seed data for default categories.
**WHY:** Provides the complete database foundation matching the spec. Execute this SQL in Supabase SQL Editor to create all tables with proper security, constraints, and indexes before building API routes.

## 2025-11-25 - Auth UI & Session (Phase 3)
**WHAT:** Added `/app/(auth)/login` and `/app/(auth)/register` pages with email/password forms (plain Tailwind + shadcn Button). Implemented `components/auth/AuthProvider.js` for client-side session context (listens to Supabase auth state). Updated `app/layout.js` to include NavBar with conditional links (login/register) or user email + logout action.
**WHY:** Enables user onboarding and authenticated flows early, allowing subsequent features (report creation, status updates) to enforce role-based access and personalize the interface without retrofitting session plumbing later.
**FIX:** Adjusted `NavBar` to be a separate client component (`components/auth/NavBar.js`) imported into server layout to resolve hook error (`useAuth is not a function`) caused by using client hook inside a server component.
**FIX 2:** Corrected login/register links (removed `/(auth)/` from hrefs). Route groups in Next.js are folder-only and parentheses are stripped from the URL, so pages at `app/(auth)/login` and `app/(auth)/register` resolve to `/login` and `/register`.

## 2025-11-25 - Reports API (Phase 4)
**WHAT:** Implemented `/app/api/reports/route.js` with GET (filters: status, category, optional bounding-box by `lat`,`lng`,`radius`; pagination via `page`,`limit`) and POST (create report with validation, optional `Authorization: Bearer <token>` to associate `user_id`). Returns items and meta per spec.
**WHY:** Provides the core backend endpoints for report creation and listing, enabling the next steps (upload images, map display, duplicate detection, workflow updates).

## 2025-11-25 - Image Upload API (Phase 5)
**WHAT:** Installed Sharp; created `/app/api/upload/route.js` accepting multipart `image` field. Validates MIME (JPEG/PNG) and size (10MB max). Uses Sharp to generate optimized large version (1600px) and thumbnail (300px). Returns paths, dimensions, URLs (currently stubbed until Supabase Storage bucket `uploads` is created manually).
**WHY:** Enables image attachment to reports with automatic optimization and thumbnail generation, reducing bandwidth and improving page load times. Ready to wire to Supabase Storage once bucket is configured.

## 2025-11-25 - Map View (Phase 6)
**WHAT:** Added Leaflet + React-Leaflet dependencies; created `components/reports/ReportsMap.js` and `app/reports/page.js`. Implemented dynamic import (`ssr: false`) to prevent `window is not defined` on server render; globally imported Leaflet CSS. Map centers on first report (or `[0,0]` if none) and shows markers with optional thumbnail popup. Added `with_images=true` support to reports GET route to load first image thumbnail per report.
**WHY:** Provides visual geographic context for reports and prepares groundwork for realtime updates, clustering, and spatial queries. Dynamic import ensures compatibility with Next.js App Router SSR.
**NOTE:** Blank blue tiles indicate map loaded at ocean (no reports yet) — seed reports to see markers.

## 2025-11-25 - Duplicate Detection (Phase 7 - In Progress)
**WHAT:** Implemented `lib/duplicate.js` with Jaccard text similarity + Haversine distance; integrated into POST `/api/reports` to compute `possible_duplicates` before insertion. Added unit tests for similarity, distance, and duplicate selection; created Supabase client mocks for test isolation.
**WHY:** Early duplicate flagging reduces noise and enables future merge workflows and audit logging. Returning candidates now lets UI offer merge or confirm actions later.
**NEXT:** May add automatic flag/status (`potential_duplicate`) and persistence of duplicate relationships; consider batch query optimization and indexing for performance.
\n+## 2025-11-25 - Schema Enhancements & Locations (Phase 7 Enhancements / 7b Start)
**WHAT:** Extended schema: added `pg_trgm` extension, `locations` table + Algarve seeds, new `reports` columns (`location_id`, `is_potential_duplicate`, `suppressed`), indexes for trigram search, location grouping, suppression, duplicates. Added `report_duplicate_candidates` table and RLS policies. Created `lib/locations.js` utilities (`fetchLocationsWithStats`, `fetchReportsByLocation`, `clusterReports`, `findNearestLocation`, `suppressDuplicates`). Updated reports POST API to auto-assign nearest location and set `is_potential_duplicate` flag. Added locations API endpoints `/api/locations` and `/api/locations/[slug]` plus new pages `/locations` (grid of towns) and `/locations/[slug]` (detail map + clustered markers + report list). Implemented lightweight spatial-time clustering (grid + time window) rendered with `CircleMarker` for multi-report clusters.
**WHY:** Introduces geographic hierarchy (town-level browsing) for better UX, performance (filtered queries), and future analytics per municipality. Trigram + duplicate metadata lay groundwork for fuzzy search and suppression workflows.
**TESTS:** Added `tests/lib/locations.test.js` for clustering logic; all tests pass. Mocked Supabase in tests to avoid env dependency errors.\n
