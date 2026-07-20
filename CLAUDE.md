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

### Roadmap & Planning Docs
- **`ROADMAP.md`** — canonical project roadmap. Check this first when asked what remains, what's planned, or whether a phase is complete.
- **`docs/superpowers/specs/`** — feature/design specs. Some older specs may already be implemented; verify against the code before treating them as open work.
- **`docs/superpowers/plans/`** — implementation plans/checklists. These can be stale after a PR lands; use them for context, not as the source of truth unless the current code and `ROADMAP.md` agree.
- Current known remaining roadmap work is Phase 7 in `ROADMAP.md`: homepage map WCAG 2.1 AA keyboard audit and contrast/focus pass. The visible homepage Map/List toggle and keyboard-equivalent list actions have shipped.

## Repo Hygiene — Non-Negotiable

The repo is public. Treat every commit as permanent.

- **No secrets, ever** — `.env` is gitignored. Certificates (`*.pem`), credentials, and keys must never be committed. If something sensitive lands in history, rotate the credential immediately and scrub the history.
- **No generated artifacts** — `.svelte-kit/`, `node_modules/`, `build/`, `logs/`, `.playwright-mcp/` stay out of the repo. If a tool dumps files into the project root, add them to `.gitignore` before committing.
- **Meaningful commits** — every commit message explains _why_, not just _what_. Atomic commits over giant dumps. No "fix", "update", or "wip" messages.
- **No debug leftovers** — don't commit `console.log`, temporary scripts, commented-out code, or test files dropped in the root.
- **No binary assets in git** — photos, screenshots, and large static files belong in Supabase storage or a CDN, not the repo.
- **Keep `main` clean** — feature work goes on a branch. `main` should always build and deploy cleanly.

When in doubt about whether something belongs in the repo, leave it out.

## Workflow

- **Create PRs proactively** — when a logical chunk of work is complete on a branch, open a PR without waiting to be asked. Use judgment: a multi-file feature, a security fix, or anything that should go through CI before merging warrants a PR. Trivial one-liner fixes on `main` may not.
- **Security incidents** — follow `INCIDENT_RESPONSE.md` in the repo root. It covers PIPEDA breach notification obligations, per-secret rotation procedures, OPC reporting timelines, and post-incident review.

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

## Tooling

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run check` | Type checking (svelte-check) |
| `npm run lint` | ESLint (TS + Svelte files) |
| `npm run test` | Playwright E2E tests |
| `npm run test:a11y` | axe-core a11y tests (Playwright) |

### Pre-commit hooks (Husky + lint-staged)
- **`.husky/pre-commit`** runs `lint-staged` on every commit
- Staged `.ts`/`.svelte` files: ESLint fix + Prettier write
- Staged `.css`/`.json`/`.md` files: Prettier write only
- CI will catch what hooks miss — this is a safety net, not a gatekeeper

### Formatting (Prettier)
- **`.prettierrc`** at project root — tabs, single quotes, trailing commas, 100-char print width
- **`.prettierignore`** mirrors `.gitignore` for build/test artifacts
- Formatted files: `src/**/*.ts`, `src/**/*.svelte`, `src/**/*.css`, plus root config files
- `prettier-plugin-svelte` handles Svelte files
- **eslint-config-prettier** disables ESLint rules that conflict with Prettier

### Unit tests
- Unit-style tests live under `tests/unit/` and currently run through Playwright (`npx playwright test tests/unit/`).
- There is no Vitest configuration or `npm run test:unit` script in the current project.
- E2E and API-level tests also use Playwright under `tests/e2e/`; axe checks use `npm run test:a11y`.

### EditorConfig
- **`.editorconfig`** enforces consistent indentation across editors
- Tabs for Svelte/TS/JS, 2-space for SQL/YAML/JSON

### Opencode plugins
- **`.opencode/opencode.json`** — project-level opencode configuration
- **`.opencode/plugins/env-protection.js`** — prevents LLM from reading/writing `.env` files (defense-in-depth)
- **`.opencode/plugins/command-inject.js`** — exposes `npm run` scripts as `/` slash commands
- Plugins listed in `opencode.json` are auto-installed from npm at startup

### MCP servers
- **GitHub** (`@modelcontextprotocol/server-github`) — issues, PRs, code review, search. Needs `GITHUB_TOKEN` env var.
- **Sentry** (`https://mcp.sentry.dev/mcp`) — error tracking, issue analysis. Uses OAuth (run `opencode mcp auth sentry` to authenticate).
- **Supabase** (`.mcp.json`) — database inspection, schema management.
- **Playwright** (`.mcp.json`) — browser automation for E2E testing.

### Dependency updates (Dependabot) — recurring lockfile bug
Dependabot's targeted (partial) `package-lock.json` updates repeatedly drop a
nested, valid entry: `node_modules/@sentry/node/node_modules/vite@6.4.3`, an
optional peer dependency `@sentry/node` needs because the root `vite` version
doesn't satisfy its declared peer range. When that nested entry is missing,
CI's `npm ci` (npm 10.9.8, bundled with the Node 22 runner) fails hard with
`EUSAGE` / `Missing: vite@6.4.3 from lock file` (plus its rollup/esbuild
platform binaries) — even though the PR's actual dependency bump is fine and
`main`'s own lockfile is self-consistent. This has recurred across unrelated
dependency groups (svelte, zod, supabase-js, tailwind), so treat it as
Dependabot tooling noise, not a real incompatibility, unless proven otherwise.

**Fix**: regenerate `package-lock.json` — but not with a bare local
`npm install`. Two platform traps stack on top of each other:
1. **macOS produces a platform-pruned lockfile** — missing the Linux-only
   optional binaries (`@rollup/rollup-linux-*`, `@esbuild/linux-*`) CI needs.
   This bit a real cleanup PR once already (see the `revert:` commit in
   `e2c2068`) and was deferred at the time.
2. **A newer local npm (11.x+) resolves peer deps more leniently** than CI's
   npm 10.9.8 and will *not* re-add the nested `@sentry/node` vite entry, so
   the regenerated lockfile still fails in CI even though it looks clean
   locally.

Regenerate inside a container matching CI's exact runtime instead:
```bash
container run --rm -v "$(pwd)":/work -w /work node:22 sh -c "npm install --package-lock-only"
container run --rm -v "$(pwd)":/work -w /work node:22 sh -c "npm ci"   # verify
```
(`container` is Apple's runtime — see the global operating doctrine. `docker`/
`podman` work identically if available.) Verify `npm run check`/`lint`/`build`
too before pushing — `webServer`/build steps need real `PUBLIC_SUPABASE_*`
values, so copy in `.env` for that step only and remove it afterward.

**Don't push the fix directly to the Dependabot branch without expecting a
reaction**: Dependabot treats any external push to its own branch as
tampering and will auto-close the PR (sometimes) within seconds — `gh pr
reopen <n>` immediately afterward is safe and picks the branch back up with
your commit intact. This is inconsistent (some pushes are left alone), so
always check `gh pr view <n> --json state,closed` after pushing.

## Environment

Copy `.env.example` → `.env` with real values:

- `PUBLIC_SUPABASE_URL` — Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — server-only key for admin routes and moderation
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
    +page.svelte              # Map (Leaflet, clustering, ward heatmap, mobile tool tray, homepage intro card, real-time polling)
    +layout.svelte            # Nav with live counts, Toaster, Map nav link
    +layout.server.ts         # Server layout loader
    +page.server.ts           # Loads potholes for map
    about/+page.svelte        # About page
    privacy/+page.svelte      # Privacy policy (PIPEDA-grade; retention, third parties, rights)
    terms/+page.svelte        # Terms of use (acceptable use, UGC licence, no-warranty, Ontario law)
    how-to/+page.svelte       # User-facing how-to / help guide
    stats/
      +page.server.ts         # SSR load — potholes for metrics
      +page.svelte            # Metrics dashboard (resolution time, ward leaderboards, trends, fill rate)
    report/+page.svelte       # GPS report form with severity selector
    admin/
      map/
        +page.svelte          # Admin map view (Leaflet, markercluster, status filter toggles, click-to-manage)
        +page.server.ts       # Loads all potholes for admin map (admin-auth required)
      potholes/[id]/
        +page.svelte          # Admin pothole detail (description editing, before/after photo split)
        +page.server.ts       # Loads single pothole + photos; form actions for updateDescription
    hole/[id]/
      +page.svelte            # Pothole detail (status, councillor contact, share, before/after photo galleries)
      +page.server.ts         # Loads single pothole + councillor
    api/
      potholes/recent/+server.ts  # GET — polling endpoint: non-pending potholes created/reported/filled/expired after ?since=
      report/+server.ts       # POST — submit report (geofence, IP dedup, 2-confirm merge)
      filled/+server.ts       # POST — mark filled (reported → filled)
      photos/+server.ts       # POST — upload photo (magic-byte validation, moderation, rate limit)
      wards.geojson/+server.ts # GET — ward boundaries for heatmap
      feed.json/+server.ts    # GET — JSON feed of recent potholes
      export.csv/+server.ts   # GET — CSV export of all reported/filled potholes (open data)
      feed.xml/+server.ts     # GET — RSS 2.0 feed of recent confirmations/fills (open data)
      hit/+server.ts           # POST — "I hit this" signal (community prioritization)
      vote/+server.ts          # POST/DELETE — upvote/downvote (community prioritization)
      ccc/[id]/+server.ts           # GET — ArcGIS CCC repair data proxy (off SSR path)
      notify/[id]/+server.ts        # POST/DELETE — per-pothole fill notification subscription
      notify/ward/+server.ts        # POST/DELETE — ward-level "new pothole" alert subscription
      geocode/search/+server.ts     # GET — Nominatim search proxy (sets User-Agent server-side)
      geocode/reverse/+server.ts    # GET — Nominatim reverse geocode proxy
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
      og-helpers.ts           # Shared satori el() helper for OG image routes
      wards.ts                # fetchWards/lookupWard wrapped with logError (server callers import from here)
    components/
      HomeIntroCard.svelte    # Homepage-only intro card shown on first visit
```

## Database Schema

```sql
potholes (
  id uuid PK, created_at, lat float8, lng float8,
  address text, description text,
  status text,          -- 'pending' | 'reported' | 'expired' | 'filled'
  reported_at timestamptz,  -- stamped by increment_confirmation on pending -> reported
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

pothole_votes (
  id uuid PK, pothole_id uuid FK, ip_hash text,
  vote_direction smallint,  -- 1 = upvote, -1 = downvote
  created_at timestamptz
  UNIQUE(pothole_id, ip_hash)
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
17. `schema_push_subscription_ttl.sql` — adds `last_used_at` to `push_subscriptions`; pg_cron purge job for subscriptions not refreshed in 180 days (PIPEDA data minimization)
18. `schema_audit_ttl.sql` — pg_cron purge jobs for `admin_auth_attempts` (90 days) and `admin_audit_log` (24 months) (PIPEDA data minimization)
19. `schema_hits_ttl.sql` — pg_cron purge jobs for `pothole_hits` and `pothole_actions` older than 90 days (PIPEDA data minimization)
20. `schema_pothole_confirmations_ttl.sql` — pg_cron purge job for `pothole_confirmations` on resolved potholes older than 90 days (PIPEDA data minimization)
21. `schema_fill_notifications.sql` — `pothole_fill_subscriptions` table; pg_cron cleanup for subscriptions on potholes expired > 7 days
22. `schema_fill_notify_ratelimit.sql` — extends `api_rate_limit_events_scope_check` to include `fill_notify_subscribe` and `push_unsubscribe`
23. `schema_grants.sql` — explicit `GRANT` statements for `anon` (SSR reads) and `service_role` (all server-side writes) on every public-schema table; required for Supabase's new default-deny Data API behaviour enforced on existing projects from October 30, 2026
24. `schema_votes.sql` — `pothole_votes` table for upvote/downvote (community prioritization)
25. `schema_vote_ratelimit.sql` — extends `api_rate_limit_events_scope_check` to include `vote_submit`
26. `schema_votes_ttl.sql` — pg_cron purge job for `pothole_votes` older than 90 days (PIPEDA data minimization)
27. `schema_ward_subscriptions.sql` — adds `ward_subscriptions` table (ward-level push alert subscriptions) and extends `api_rate_limit_events_scope_check` to include `ward_notify_subscribe`
28. `schema_pothole_reported_at.sql` — adds `reported_at` timestamptz column (backfilled for existing non-pending rows) and redefines `increment_confirmation` to stamp it on the `pending → reported` flip, so the polling endpoint can detect that transition
29. `schema_polling_indexes.sql` — partial indexes on `filled_at`/`expired_at` (where not null) so the `/api/potholes/recent` poll's `.or(...)` filter can use a BitmapOr instead of scanning all non-pending rows (#205)
30. `schema_revoke_public_writes.sql` — **security (critical):** drops the leftover public write RLS policies (`"Public insert"`/`"Public update"` on potholes, `"Public insert"` on confirmations/actions) and `REVOKE`s the legacy broad write grants from `anon`/`authenticated` (keeps SELECT). All writes go through the service-role client; without this the shipped anon key could INSERT/UPDATE potholes directly via PostgREST. Supersedes the (grant-only, no-revoke) `schema_grants.sql` for the write-lockdown. (#200)

Eleven `pg_cron` jobs run nightly:

- `expire-old-potholes` (03:00 UTC): sets `status = 'expired'` on `reported` potholes older than 90 days.
- `expire-stale-pending` (03:30 UTC): sets `status = 'expired'` on `pending` potholes older than 14 days (anti-suppression).
- `purge-rate-limit-events` (04:00 UTC): deletes `api_rate_limit_events` rows older than 90 days (PIPEDA data minimization).
- `purge-pothole-hits` (04:15 UTC): deletes `pothole_hits` rows older than 90 days (PIPEDA data minimization).
- `purge-pothole-actions` (04:30 UTC): deletes `pothole_actions` rows older than 90 days (PIPEDA data minimization).
- `purge-pothole-confirmations` (04:45 UTC): deletes `pothole_confirmations` for potholes that have been `filled` or `expired` for > 90 days (PIPEDA data minimization).
- `purge-stale-push-subscriptions` (05:00 UTC): deletes `push_subscriptions` rows where `last_used_at` is older than 180 days (PIPEDA data minimization).
- `purge-fill-subscriptions` (05:15 UTC): deletes `pothole_fill_subscriptions` for potholes that have been `expired` for > 7 days (safety net; subscriptions are normally deleted on send).
- `purge-admin-auth-attempts` (05:30 UTC): deletes `admin_auth_attempts` rows older than 90 days (PIPEDA data minimization).
- `purge-pothole-votes` (05:45 UTC): deletes `pothole_votes` rows older than 90 days (PIPEDA data minimization).
- `purge-admin-audit-log` (06:00 UTC): deletes `admin_audit_log` rows older than 24 months (PIPEDA breach investigation minimum).

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
- **Coord privacy**: reporter lat/lng is rounded to 4 decimal places (≈11m at Waterloo latitude) at write-time via `roundPublicCoord()` in `$lib/geo` — the precision is a hard-coded constant, not an env var. Geofence + merge-radius logic runs on the raw input so decisions aren't shifted by rounding. All public read/serialization paths (feed.json, feed.xml, export.csv, embed, OG, `/api/watchlist`, `/api/potholes/recent`, the homepage `+page.server.ts` load, and the `hole/[id]` JSON-LD `geo` block) re-apply `roundPublicCoord` as defense-in-depth for any historical rows stored at full precision.
- **Photo EXIF**: server-side strip in `$lib/server/exif-strip` runs before SightEngine moderation and storage upload. `stripJpegMetadata` drops APP1–APP15 and COM segments from JPEGs. `stripPngMetadata` drops the `eXIf` chunk from PNGs. `stripWebpMetadata` drops EXIF/XMP chunks from VP8X-extended WebPs (simple VP8/VP8L files carry no metadata by spec). All three return the input unchanged on malformed input.
- **Auto-expiry**: `reported` potholes expire after 90 days; `pending` potholes expire after 14 days (both via pg_cron)
- **Real-time polling**: homepage polls `/api/potholes/recent?since=` every 60s for new/changed potholes without requiring page reload. The query filters on `created_at`, `reported_at`, `filled_at`, or `expired_at` being after `since`, so a `pending → reported` transition (which stamps `reported_at` via `increment_confirmation`) is surfaced even though it doesn't touch `created_at`. Polling starts after map loads, pauses on disconnect.
- **Ward alerts**: residents can subscribe (browser push, no account) to a council ward on `/stats/ward/[city]/[ward]` via `/api/notify/ward`; subscriptions live in `ward_subscriptions` (service-role only, keyed `${city}-${ward}`, no user location stored). When a pothole flips `pending → reported`, `api/report` resolves its ward and fans out via `notifyWardSubscribers` (`$lib/server/webpush`) — best-effort, awaited, prunes only 410/404 endpoints (persistent, unlike one-shot fill subs).
- **Admin map**: Leaflet + markercluster at `/admin/map` with status-filtered layers and click-to-manage popups. Loads all 5000 potholes. Admin-auth required.
- **Before/after photos**: when pothole status is `filled`, the detail page splits published photos into before/after galleries via `splitByFill()` in `$lib/photo-split` — a read-time classification (`created_at < filled_at` = before, `>= filled_at` = after); a photo taken exactly at `filled_at` counts as "after". The split renders only when both eras have a photo, else the flat gallery shows. Marking a pothole filled prompts (optionally) for an "after" photo.
- **Admin description editing**: admins can edit pothole description via form action on `/admin/potholes/[id]`.
- **"Prioritize" community vote**: an upvote-only signal on `reported` potholes, shown as "Prioritize · N" next to the "I hit this" card on the detail page. The `pothole_votes` backend supports `direction: 1 | -1` (up/down), but the UI only ever sends `direction: 1` via `POST /api/vote` — a second tap sends `DELETE /api/vote` to remove the vote, rather than exposing a downvote. This avoids downvotes suppressing legitimate hazards. Distinct from "I hit this" (a physical encounter) — Prioritize means "this needs attention." Vote state is tracked client-side in `localStorage` (`vote:<id>`); `pothole_votes` has no anon SELECT policy, so `voteCount` is loaded server-side via the service-role client, mirroring `hitCount`.

## Svelte 5 Patterns (important — don't use Svelte 4 syntax)

```svelte
let count = $state(0)              // NOT: let count = writable(0)
let doubled = $derived(count * 2)  // NOT: $: doubled = count * 2
let { data } = $props()            // NOT: export let data
$effect(() => { ... })             // NOT: $: { ... } for side effects
```

## Coding Conventions

- Stone palette (light + dark), amber accent colour (the 2026-05 redesign; `--color-asphalt` dark bg, amber `#f59e0b` focus ring)
- Tailwind v4 utility classes (not v3 — no `@apply` in components)
- API routes validate with zod, return `json()` or throw `error()`
- No auth system — all actions are public with IP-based deduplication
- Leaflet imports must be inside `onMount` (SSR will break otherwise)
- Server-side error logging: use `logError(area, message, err, context?)` from `$lib/server/observability` instead of bare `console.error`. It writes to the console AND forwards to Sentry with an `area` tag so issues surface in production. Bare `console.error` on a server route is a silent failure — nobody sees it.
- Any `error(500)`/`fail(500)` (or `502`/`503`) that swallows a captured Supabase/DB/RPC/fetch error must be preceded by a `logError` call passing that error. SvelteKit treats errors thrown via `error()`/`fail()` as *expected* HttpErrors, so they never reach Sentry on their own — without the `logError` the underlying failure is invisible to the operator.
