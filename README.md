# 🕳️ fillthehole.ca

**Waterloo Region pothole tracker.** Report a pothole, confirm others, and track it through to resolution.

Live at **[fillthehole.ca](https://fillthehole.ca)**

---

## What it does

Potholes in Kitchener, Waterloo, and Cambridge often sit unfilled for weeks. This app gives residents a way to:

1. **Report** a pothole at their GPS location (or search by address / drop a pin)
2. **Confirm** reports from others — by default, 2 independent confirmations are required before it goes live
3. **Watch** potholes you care about — saved locally in your browser
4. **Celebrate** when the city finally fills it

Each pothole page shows the ward councillor's contact info, any matching city repair requests, and a direct link to submit a service request.

---

## Stack

- **[SvelteKit](https://kit.svelte.dev)** + TypeScript + Svelte 5 runes
- **[Tailwind CSS v4](https://tailwindcss.com)** via `@tailwindcss/vite`
- **[Supabase](https://supabase.com)** — Postgres with Row Level Security
- **[Leaflet](https://leafletjs.com)** + `leaflet.markercluster` for the map
- **[@fontsource/barlow-condensed](https://www.npmjs.com/package/@fontsource/barlow-condensed)** for local OG image font loading
- **[Netlify](https://netlify.com)** for deployment

---

## Local development

### Prerequisites

- Node 22+
- A Supabase project (free tier works)

### Setup

```bash
git clone https://github.com/BreakableHoodie/filltheholedotca.git
cd filltheholedotca
npm install
cp .env.example .env
# Fill in your Supabase credentials in .env
```

### Database

Run the migration files against your Supabase project in order:

1. `schema.sql` — initial tables
2. `schema_update.sql` — confirmation system
3. `schema_photos.sql` — photo uploads
4. `schema_photo_publishing.sql` — per-pothole photo publishing toggle
5. `schema_site_settings.sql` — site settings table + `increment_confirmation` RPC
6. `schema_pr61_fixes.sql` — RLS hardening
7. `schema_security_hardening.sql` — revoke public RPC access, deferred photo status
8. `schema_sprint3.sql` — pothole expiry pg_cron jobs, drop public pothole_actions SELECT
9. `schema_pushover_settings.sql` — Pushover notification toggles (default: all enabled)

### Run

```bash
npm run dev
```

App runs at `http://localhost:5173`.

---

## Environment variables

| Variable                    | Description                                                               |
| --------------------------- | ------------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`       | Supabase project URL                                                      |
| `PUBLIC_SUPABASE_ANON_KEY`  | Supabase anon key (public)                                                |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key for admin/moderation routes                      |
| `ADMIN_SECRET`              | Bearer token required for `/api/admin/*` routes                           |
| `SIGHTENGINE_API_USER`      | Image moderation — optional                                               |
| `SIGHTENGINE_API_SECRET`    | Image moderation — optional                                               |
| `IP_HASH_SECRET`            | Server-only HMAC key for immediate IP hashing on ingestion                |
| `ADMIN_SESSION_SECRET`      | 32-byte hex key for signing admin session cookies                         |
| `TOTP_ENCRYPTION_KEY`       | 32-byte hex AES-GCM key for encrypting TOTP secrets at rest               |
| `ADMIN_BOOTSTRAP_SECRET`    | One-time secret for creating the first admin account — see section below  |
| `PUSHOVER_APP_TOKEN`        | Pushover app token — optional, disables push notifications if absent      |
| `PUSHOVER_USER_KEY`         | Pushover user/group key — required alongside `PUSHOVER_APP_TOKEN`         |
| `SIGHTENGINE_WORKFLOW_ID`   | Optional SightEngine workflow ID for automated moderation rules            |

See `.env.example` for the full list. Pushover notification categories (photos, community events, security alerts) can be toggled on/off per-category from **Admin → Settings → Site** without a deployment.

---

## First admin setup

Before any admin users exist, `/admin/signup` enters **bootstrap mode**, allowing you to create the first admin account without a manual database invite.

1. Generate a strong random secret:
   ```bash
   openssl rand -hex 32
   ```
2. Add it to your `.env`:
   ```
   ADMIN_BOOTSTRAP_SECRET=<the generated value>
   ```
3. Visit `/admin/signup` — you will see the bootstrap form.
4. Enter your details and the bootstrap secret to create the first admin account (active immediately, no activation step required).
5. Once the first admin exists, `/admin/signup` automatically switches to invite-only mode. The bootstrap secret is ignored from that point on.

---

## How it works

### Confirmation system

To prevent spam, a new report starts as `pending` and only becomes public after independent confirmations from different IPs. The confirmation threshold defaults to **2** and can be adjusted in site settings. IPs are HMAC-SHA-256 hashed immediately with a server-only secret — no raw addresses are ever stored.

### Status pipeline

```text
pending → reported → filled
             ↓
          expired  (auto after 90 days with no action)
```

- **pending** — awaiting the confirmation threshold
- **reported** — live on the map, needs city attention
- **filled** — city patched it
- **expired** — auto-closed after 90 days with no fill event

### Ward heatmap

The map includes an optional ward heatmap showing pothole density by ward across all three cities. Hovering a ward shows the councillor's name and the active hole count. Clicking through the pothole detail page lets you email the councillor directly.

### City repair requests

The pothole detail page surfaces matching repair requests from the city's open data, so you can see if the city is already aware of the issue.

### Watchlist

Potholes can be added to a personal watchlist stored in your browser's local storage — no account needed.

### Stats

The `/stats` page shows resolution time, ward leaderboards, fill rate trends, and other metrics across the dataset.

### Geofence

Reports are restricted to the Waterloo Region boundary (lat 43.32–43.53, lng -80.59 to -80.22). Submissions outside that range are rejected.

---

## Privacy

- No accounts, no cookies, no tracking
- GPS coordinates are stored only to place the pin — no movement data
- IP addresses are HMAC-SHA-256 hashed on arrival and never stored in raw form
- Map tiles served by OpenStreetMap; reverse geocoding by Nominatim

See [fillthehole.ca/about#privacy](https://fillthehole.ca/about#privacy) for the full policy.

---

## Contributing

Issues and PRs welcome. If you're adding a feature, open an issue first to discuss it — this is a focused civic tool, not a general platform.

---

## License

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0)

Open source. Anyone can use, modify, and run this — but if you distribute a modified version or run it as a hosted service, you must also publish your source code under the same license.
