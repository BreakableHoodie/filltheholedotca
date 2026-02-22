# fillthehole.ca — Claude Context

Pothole reporting & accountability app for **Waterloo Region, Ontario**.
Users report potholes, the community confirms them, and the system tracks them through to resolution.

## Security — Non-Negotiable

Security is critical at every juncture. This app accepts untrusted public input and exposes data publicly — treat every boundary as hostile.

- **Validate all input** at the API layer with zod before touching the database. Never trust client-supplied data.
- **Never expose secrets** — env vars stay server-side. `PUBLIC_` prefix is for genuinely public values only.
- **Prevent injection** — always use parameterized Supabase queries. Never interpolate user input into SQL or raw queries.
- **Sanitize before rendering** — escape user-supplied strings before inserting into HTML (e.g. `escapeHtml()` in map popups). XSS is a real risk with Leaflet's `bindPopup`.
- **Rate-limit & geofence** — the report endpoint enforces a geofence and IP-hash deduplication. Any new public endpoint must have equivalent abuse protection.
- **No raw PII** — IPs are SHA-256 hashed immediately and the hash is what gets stored. Never log or persist raw IP addresses.
- **Admin routes require auth** — any endpoint under `/api/admin/` must validate a secret token or session. Do not make admin operations publicly accessible.
- **Supabase RLS is the last line of defence** — all tables have Row Level Security enabled. Never disable it, and review policies when adding new tables.
- **Dependencies** — don't add packages without checking for known CVEs. Keep dependencies minimal.

When in doubt, refuse the operation and ask rather than implementing something that could introduce a vulnerability.

## Stack
- **SvelteKit** + TypeScript, **Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`)
- **Tailwind CSS v4** (no config file — uses `@tailwindcss/vite` plugin, not PostCSS)
- **Supabase** — Postgres + RLS + storage bucket `pothole-photos`
- **Leaflet** + `leaflet.markercluster` — always client-only, dynamically imported in `onMount`
- **svelte-sonner** for toasts, **date-fns** for formatting, **zod** for API validation
- Deployed to **Vercel** (`@sveltejs/adapter-vercel`, Node 22.x runtime)

## Dev Server
```bash
npm run dev          # http://localhost:5173
```
Running as a macOS LaunchAgent (`ca.fillthehole.dev`) — auto-starts on login.
Logs: `logs/fillthehole.log`

To restart the service:
```bash
launchctl unload ~/Library/LaunchAgents/ca.fillthehole.dev.plist
launchctl load   ~/Library/LaunchAgents/ca.fillthehole.dev.plist
```

## Environment
Copy `.env.example` → `.env` with real values:
- `PUBLIC_SUPABASE_URL` — Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` — image moderation (optional)

## Project Structure
```
src/
  routes/
    +page.svelte              # Map (Leaflet, clustering, ward heatmap, locate-me)
    +layout.svelte            # Nav with live counts, WelcomeModal, Toaster
    +layout.server.ts         # Server layout loader
    +page.server.ts           # Loads potholes for map
    about/+page.svelte        # About page
    report/+page.svelte       # GPS report form with severity selector
    hole/[id]/
      +page.svelte            # Pothole detail (status, councillor contact, share)
      +page.server.ts         # Loads single pothole + councillor
    api/
      report/+server.ts       # POST — submit report (geofence, IP dedup, 3-confirm merge)
      wanksy/+server.ts       # POST — flag pothole (reported → wanksyd)
      filled/+server.ts       # POST — mark filled (wanksyd → filled)
      wards.geojson/+server.ts # GET — ward boundaries for heatmap
      feed.json/+server.ts    # GET — JSON feed of recent potholes
      admin/pothole/[id]/+server.ts  # DELETE/PATCH — admin moderation
  lib/
    types.ts                  # Pothole, PotholeStatus types
    wards.ts                  # COUNCILLORS array (ward/name/email/url)
    supabase.ts               # Supabase client (public anon)
    components/
      WelcomeModal.svelte     # First-visit onboarding modal
```

## Database Schema
```sql
potholes (
  id uuid PK, created_at, lat float8, lng float8,
  address text, description text,
  status text,          -- 'pending' | 'reported' | 'wanksyd' | 'filled'
  wanksy_at timestamptz, filled_at timestamptz,
  confirmed_count int   -- starts at 1, promoted to 'reported' at 3
)

pothole_confirmations (
  id uuid PK, pothole_id uuid FK, ip_hash text, created_at
  UNIQUE(pothole_id, ip_hash)
)
```
Run `schema.sql` for initial setup, `schema_update.sql` for the confirmation system.

## Status Flow
```
pending → reported → wanksyd → filled
  (1 report)  (3 confirmations) (flagged) (city fixed it)
```

## Key Business Rules
- **Geofence**: Waterloo Region only — lat 43.32–43.53, lng -80.59 to -80.22
- **Merge radius**: 50m — nearby pending reports are merged, not duplicated
- **3 confirmations** from distinct IPs required to go live on the public map
- **IP hashing**: SHA-256, never store raw IPs
- **`wanksyd`** = Wanksy-inspired status — someone physically flagged/reported to the city

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
