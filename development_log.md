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
**TESTS:** Added `tests/lib/locations.test.js` for clustering logic; all tests pass. Mocked Supabase in tests to avoid env dependency errors.

## 2025-11-26 - Realtime & UX Enhancements (Phase 8 - Live Updates)
**WHAT:** Added Supabase Realtime subscriptions across the app. `/app/reports/page.js` now live-updates the map and recent list when reports are created/updated; increased fetch to `limit=1000` for a fuller Algarve view. `/app/locations/page.js` subscribes to report changes and refreshes town stats (total/active) live. `/app/locations/[slug]/page.js` refreshes its data when related reports change. `/app/dashboard/page.js` auto-refreshes on report changes. Updated `components/reports/ReportsMap.js` to default to Algarve and fit bounds to all markers; updated `components/locations/LocationMap.js` to fit bounds and show only active (non-resolved/rejected) reports for a clear “live” view.
**WHAT (2):** Added town binding in the report form: `components/reports/ReportForm.js` now fetches towns and includes a "Bind to Town" dropdown; `POST /api/reports` respects `location_id` if provided (falls back to nearest town otherwise).
**WHAT (3):** Implemented toast notifications via `components/ui/toast.js` and wrapped layout with `ToastProvider`. `reports` and `dashboard` pages now show toasts on INSERT/UPDATE/DELETE events.
**WHAT (4):** Main map clustering: `components/reports/ReportsMap.js` now groups dense markers using the existing `clusterReports` helper, and hides resolved reports after 1 hour (using `updated_at`), while showing ongoing statuses immediately.
**WHAT (5):** Fixed location stats: `lib/locations.fetchLocationsWithStats` now computes `active` as non-resolved/rejected and `count` as `ongoing + resolved within 1 hour`; also returns `last_report_at`. `lib/locations.fetchReportsByLocation` includes `updated_at` for accurate time-based logic.
**WHY:** Ensures users and staff see up-to-the-minute data without manual refresh, improving trust and operational responsiveness. Explicit town binding removes ambiguity and supports administrative workflows tied to municipalities. Clustering prevents marker overload; toast feedback improves perceived responsiveness; location stats now reflect the requested business rules.
**NOTE:** Realtime uses anonymous client subscriptions; ensure Supabase Realtime is enabled for the `reports` table in your project settings.

## 2025-11-26 - Critical Realtime & Caching Fixes (Phase 8 - Production Ready)
**WHAT:** Diagnosed and fixed multiple critical issues preventing live updates:
1. **Next.js Route Caching**: Added `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` to all GET API routes (`/api/locations`, `/api/locations/[slug]`, `/api/reports`, `/api/reports/[id]`, `/api/categories`). Added `Cache-Control: no-store, no-cache, must-revalidate` headers to all API responses.
2. **Client-Side Fetch Caching**: Added `cache: 'no-store'` and `Cache-Control: no-cache` headers to all client-side fetch calls in pages (`/locations`, `/locations/[slug]`, `/reports`, `/dashboard`).
3. **Realtime Closure Bugs**: Fixed stale closure issues in `/locations/[slug]/page.js` where `data` was captured as `null` during effect initialization, preventing proper filtering. Split into two effects: one for data loading, second for realtime subscription (dependent on `data.location.id`).
4. **Dependency Array Issues**: Added missing dependencies (`addToast`) to realtime effect arrays in `/reports/page.js` and `/dashboard/page.js` to prevent stale references.
5. **Debugging Console Logs**: Added comprehensive `console.log` statements to all realtime callbacks showing event type and payload for developer visibility.
6. **Auto Town Detection**: Enhanced `ReportForm.js` to automatically detect and set nearest town when coordinates are selected, preventing orphaned reports.
7. **Batch Stats Computation**: Rewrote `fetchLocationsWithStats` to fetch all reports once and compute stats in-memory instead of per-location queries, eliminating query inconsistencies.

**WHY:** The app was showing stale data even after deleting records from Supabase because:
- Next.js 14 aggressively caches routes by default
- Browser was caching fetch responses
- Realtime callbacks had closure bugs capturing null/stale state
- Missing dependencies caused React to use old function references

These fixes ensure ZERO caching—every page load and realtime event fetches fresh data directly from Supabase. The app is now truly live with instant updates across all views.

**TESTING STEPS:**
1. Open browser DevTools console (F12)
2. Navigate to `/locations` - watch for `[Locations Stats Realtime]` logs
3. Navigate to `/reports` - watch for `[Reports Realtime]` logs
4. Create a new report - should see INSERT event in console + toast notification
5. Delete a report in Supabase Table Editor - should see DELETE event + immediate UI update
6. Verify counts on `/locations` update instantly after any report change

**TECHNICAL NOTES:**
- All API routes now force dynamic rendering (no static optimization)
- All client fetches bypass Next.js cache layer
- Realtime subscriptions properly track location/report relationships
- Multiple independent subscriptions (locations, reports, dashboard, location-detail) work in parallel

**PERFORMANCE:** Batch stats query reduced per-town API calls from 4-5 to 1 total, improving `/locations` load time significantly.

\n
