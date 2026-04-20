# fillthehole.ca — Claude Context

Pothole reporting & accountability app for **Waterloo Region, Ontario**.
Users report potholes, the community confirms them, and the system tracks them through to resolution.

## Security — Non-Negotiable

Security is critical at every juncture. This app accepts untrusted public input and exposes data publicly — treat every boundary as hostile.

- **Validate all input** at the API layer with zod before touching the database. Never trust client-supplied data.
- **Never expose secrets** — env vars stay server-side. `PUBLIC_` prefix is for genuinely public values only.
- **Prevent injection** — always use parameterized Supabase queries. Never interpolate user input into SQL or raw queries.
- **Sanitize before rendering** — escape user-supplied strings before inserting into HTML (e.g. `escapeHtml()` in map popups). XSS is a real risk with Leaflet's `bindPopup`.
- **Rate-limit & geofence** — report/photo endpoints enforce geofence and DB-backed abuse throttling. Any new public endpoint must have equivalent abuse protection.
- **No raw PII** — IPs are HMAC-SHA-256 hashed immediately with `IP_HASH_SECRET`; only the hash is stored. Never log or persist raw IP addresses.
- **Admin routes require auth** — any endpoint under `/api/admin/` must validate a secret token or session. Do not make admin operations publicly accessible.
- **Supabase RLS is the last line of defence** — all tables have Row Level Security enabled. Never disable it, and review policies when adding new tables.
- **Dependencies** — don't add packages without checking for known CVEs. Keep dependencies minimal.
- **User-Generated Content (UGC)** — any image uploads must pass automated moderation (e.g. SightEngine) AND be reviewable by admins. Never display unmoderated binaries.

When in doubt, refuse the operation and ask rather than implementing something that could introduce a vulnerability.

## Documentation — Keep It Current

Documentation that's wrong is worse than no documentation. Update it in the same commit as the code change.

- **CLAUDE.md** — update whenever the stack, architecture, status flow, DB schema, or key rules change. If you add a new env var, API route, or library, it goes here.
- **README.md** — reflects what a new contributor needs to know. If setup steps change or new scripts are added, update it immediately.
- **`.env.example`** — must stay in sync with every env var the app actually uses. Adding a new `$env/static/*` import? Add the var to `.env.example` in the same commit or CI will break.
- **`schema.sql`** — the canonical source of truth for the DB. Any migration applied to Supabase must be reflected here so the schema is always reproducible from scratch.
- **Code comments** — only where the logic isn't obvious. Prefer clear code over stale comments. Delete comments when the code they describe changes.

If a PR touches infrastructure, routes, or the DB schema without updating the relevant docs, treat it as incomplete.

## Repo Hygiene — Non-Negotiable

The repo is public. Treat every commit as permanent.

- **No secrets, ever** — `.env` is gitignored. Certificates (`*.pem`), credentials, and keys must never be committed. If something sensitive lands in history, rotate the credential immediately and scrub the history.
- **No generated artifacts** — `.svelte-kit/`, `node_modules/`, `build/`, `logs/`, `.playwright-mcp/` stay out of the repo. If a tool dumps files into the project root, add them to `.gitignore` before committing.
- **Meaningful commits** — every commit message explains _why_, not just _what_. Atomic commits over giant dumps. No "fix", "update", or "wip" messages.
- **No debug leftovers** — don't commit `console.log`, temporary scripts, commented-out code, or test files dropped in the root.
- **No binary assets in git** — photos, screenshots, and large static files belong in Supabase storage or a CDN, not the repo.
- **Keep `main` clean** — feature work goes on a branch. `main` should always build and deploy cleanly.

When in doubt about whether something belongs in the repo, leave it out.

## Stack

- **SvelteKit** + TypeScript, **Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`)
- **Tailwind CSS v4** (no config file — uses `@tailwindcss/vite` plugin, not PostCSS)
- **Supabase** — Postgres + RLS + storage bucket `pothole-photos`
- **Leaflet** + `leaflet.markercluster` — always client-only, dynamically imported in `onMount`
- **@fontsource/barlow-condensed** — local OG image font asset (no runtime CDN dependency)
- **svelte-sonner** for toasts, **date-fns** for formatting, **zod** for API validation
- **@sentry/sveltekit** — error tracking (server + client); disabled when `PUBLIC_SENTRY_DSN` is absent
- Deployed to **Netlify** (`@sveltejs/adapter-netlify`)
- **License**: GNU Affero General Public License v3.0 (AGPL-3.0)

## Dev Server

```bash
npm run dev          # http://localhost:5173
```

## Environment

Copy `.env.example` → `.env` with real values:

- `PUBLIC_SUPABASE_URL` — Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — server-only key for admin routes and moderation
- `ADMIN_SECRET` — bearer token for `/api/admin/*` endpoints
- `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` / `SIGHTENGINE_WORKFLOW_ID` — image moderation (optional)
- `IP_HASH_SECRET` — server-only HMAC key for IP hashing
- `ADMIN_SESSION_SECRET` — 32-byte hex key for signing admin CSRF tokens
- `TOTP_ENCRYPTION_KEY` — 32-byte hex AES-GCM key for encrypting TOTP secrets at rest
- `ADMIN_BOOTSTRAP_SECRET` — one-time secret for creating the first admin account
- `PUSHOVER_APP_TOKEN` / `PUSHOVER_USER_KEY` — push notifications (optional; omit both to disable)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `PUBLIC_VAPID_PUBLIC_KEY` — web push VAPID keys (optional)
- `PUBLIC_SENTRY_DSN` — Sentry project DSN (optional; omit to disable error tracking in dev)
- `BLUESKY_HANDLE` / `BLUESKY_APP_PASSWORD` — Bluesky bot credentials (optional; omit both to disable auto-posting)
- `DISABLE_API_RATE_LIMIT` — set to any value to disable rate limiting in dev/test (never in production)

## Project Structure

```text
src/
  routes/
    +page.svelte              # Map (Leaflet, clustering, ward heatmap, mobile tool tray, homepage intro card)
    +layout.svelte            # Nav with live counts and Toaster
    +layout.server.ts         # Server layout loader
    +page.server.ts           # Loads potholes for map
    about/+page.svelte        # About page
    how-to/+page.svelte       # User-facing how-to / help guide
    stats/
      +page.server.ts         # SSR load — potholes for metrics
      +page.svelte            # Metrics dashboard (resolution time, ward leaderboards, trends, fill rate)
    report/+page.svelte       # GPS report form with severity selector
    hole/[id]/
      +page.svelte            # Pothole detail (status, councillor contact, share)
      +page.server.ts         # Loads single pothole + councillor
    api/
      report/+server.ts       # POST — submit report (geofence, IP dedup, 2-confirm merge)
      filled/+server.ts       # POST — mark filled (reported → filled)
      photos/+server.ts       # POST — upload photo (magic-byte validation, moderation, rate limit)
      wards.geojson/+server.ts # GET — ward boundaries for heatmap
      feed.json/+server.ts    # GET — JSON feed of recent potholes
      export.csv/+server.ts   # GET — CSV export of all reported/filled potholes (open data)
      feed.xml/+server.ts     # GET — RSS 2.0 feed of recent confirmations/fills (open data)
      admin/pothole/[id]/+server.ts  # DELETE — admin moderation
      admin/photo/[id]/+server.ts    # PATCH/DELETE — photo moderation
  lib/
    types.ts                  # Pothole, PotholeStatus types
    geo.ts                    # Shared geo utilities (pipRing, inWardFeature, roundPublicCoord)
    wards.ts                  # COUNCILLORS array (ward/name/email/url)
    supabase.ts               # Supabase client (public anon)
    server/
      observability.ts        # logError() — console + Sentry with area tags
      exif-strip.ts           # stripJpegMetadata() — lossless APP-segment stripper
    components/
      HomeIntroCard.svelte    # Homepage-only intro card shown on first visit
```

## Database Schema

```sql
potholes (
  id uuid PK, created_at, lat float8, lng float8,
  address text, description text,
  status text,          -- 'pending' | 'reported' | 'expired' | 'filled'
  filled_at timestamptz, expired_at timestamptz,
  confirmed_count int,  -- starts at 1, promoted to 'reported' at 2
  photos_published bool  -- admin toggle; published pothole ≠ published photos
)

pothole_confirmations (
  id uuid PK, pothole_id uuid FK, ip_hash text, created_at
  UNIQUE(pothole_id, ip_hash)
)

pothole_photos (
  id uuid PK, pothole_id uuid FK, storage_path text,
  ip_hash text, moderation_status text, moderation_score float8, created_at
  -- moderation_status values: 'pending' | 'approved' | 'rejected' | 'deferred'
  -- 'deferred' = SightEngine was unavailable; requires mandatory admin review
)

api_rate_limit_events (
  id uuid PK, ip_hash text, scope text, created_at
)
```

Run migrations in this order:

1. `schema.sql` — initial setup
2. `schema_update.sql` — confirmations table + security hardening
3. `schema_actions.sql` — pothole_actions table + increment_confirmation RPC
4. `schema_admin.sql` — admin users, sessions, MFA, trusted devices
5. `schema_photos.sql` — photo upload schema
6. `schema_photo_publishing.sql` — `photos_published` flag
7. `schema_site_settings.sql` — site settings table + redefines `increment_confirmation` with 3-parameter signature (must run after step 6)
8. `schema_pr61_fixes.sql` — RLS policy hardening + pending pothole backfill
9. `schema_security_hardening.sql` — revokes public EXECUTE on `increment_confirmation`; documents `deferred` photo status
10. `schema_sprint3.sql` — drops public SELECT on `pothole_actions`; fixes pg_cron interval (90 days); adds pending-pothole expiry (14 days)
11. `schema_pushover_settings.sql` — Pushover notification toggles
12. `schema_hits.sql` — "I Hit This" signal table
13. `schema_push.sql` — web push subscription storage
14. `schema_push_unsubscribe_ratelimit.sql` — adds `push_unsubscribe` scope to `api_rate_limit_events` constraint
15. `schema_review_fixes.sql` — RLS hardening; drops public read on `pothole_confirmations`
16. `schema_rate_limit_cleanup.sql` — pg_cron purge job for `api_rate_limit_events` older than 90 days (PIPEDA data minimization)

Three `pg_cron` jobs run nightly:

- `expire-old-potholes` (03:00 UTC): sets `status = 'expired'` on `reported` potholes older than 90 days.
- `expire-stale-pending` (03:30 UTC): sets `status = 'expired'` on `pending` potholes older than 14 days (anti-suppression).
- `purge-rate-limit-events` (04:00 UTC): deletes `api_rate_limit_events` rows older than 90 days (PIPEDA data minimization).

## Status Flow

```text
pending → reported → filled
  (1 report)  (2 confirmations)  (city fixed it — via popup or detail page)
                    ↓
                 expired  (auto after 90 days with no action)
```

## Key Business Rules

- **Geofence**: Waterloo Region only — lat 43.32–43.53, lng -80.59 to -80.22
- **Merge radius**: 25m — nearby pending reports are merged, not duplicated
- **2 confirmations** from distinct IPs required to go live on the public map
- **photos_published**: admin-only toggle per pothole; a live pothole does NOT mean its photos are shown — admin must explicitly publish them
- **IP hashing**: HMAC-SHA-256 with `IP_HASH_SECRET`, never store raw IPs
- **Coord privacy**: reporter lat/lng is rounded to 4 decimal places (≈11m at Waterloo latitude) at write-time via `roundPublicCoord()` in `$lib/geo` — the precision is a hard-coded constant, not an env var. Geofence + merge-radius logic runs on the raw input so decisions aren't shifted by rounding. Serialization paths (feed.json, feed.xml, export.csv, embed, OG) re-apply `roundPublicCoord` as defense-in-depth for any historical rows stored at full precision.
- **Photo EXIF**: server-side strip in `stripJpegMetadata` (`$lib/server/exif-strip`) runs before moderation and storage upload. Drops APP1 (EXIF/GPS/XMP), APP2–APP15, and COM segments from JPEGs losslessly. PNG/WebP pass through untouched; they rarely carry camera EXIF from mobile uploads.
- **Auto-expiry**: `reported` potholes expire after 90 days; `pending` potholes expire after 14 days (both via pg_cron)

## Svelte 5 Patterns (important — don't use Svelte 4 syntax)

```svelte
let count = $state(0)              // NOT: let count = writable(0)
let doubled = $derived(count * 2)  // NOT: $: doubled = count * 2
let { data } = $props()            // NOT: export let data
$effect(() => { ... })             // NOT: $: { ... } for side effects
```

## Coding Conventions

- Dark zinc palette, sky-500 accent colour
- Tailwind v4 utility classes (not v3 — no `@apply` in components)
- API routes validate with zod, return `json()` or throw `error()`
- No auth system — all actions are public with IP-based deduplication
- Leaflet imports must be inside `onMount` (SSR will break otherwise)
- Server-side error logging: use `logError(area, message, err, context?)` from `$lib/server/observability` instead of bare `console.error`. It writes to the console AND forwards to Sentry with an `area` tag so issues surface in production. Bare `console.error` on a server route is a silent failure — nobody sees it.
