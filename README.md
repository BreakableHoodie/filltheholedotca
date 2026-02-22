# 🕳️ fillthehole.ca

**Waterloo Region pothole tracker.** Report a pothole, confirm others, flag it to the city, celebrate when it's filled.

Live at **[fillthehole.ca](https://fillthehole.ca)**

---

## What it does

Potholes in Kitchener, Waterloo, and Cambridge often sit unfilled for weeks. This app gives residents a way to:

1. **Report** a pothole at their GPS location
2. **Confirm** reports from others (3 independent confirmations required before it goes live)
3. **Flag** it — go to the location, verify it, submit an official city service request, then mark it flagged here
4. **Celebrate** when the city finally fills it

Each pothole page shows the ward councillor's contact info so you can apply direct pressure.

---

## Stack

- **[SvelteKit](https://kit.svelte.dev)** + TypeScript + Svelte 5 runes
- **[Tailwind CSS v4](https://tailwindcss.com)** via `@tailwindcss/vite`
- **[Supabase](https://supabase.com)** — Postgres with Row Level Security
- **[Leaflet](https://leafletjs.com)** + `leaflet.markercluster` for the map
- **[Vercel](https://vercel.com)** for deployment

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

Run `schema.sql` against your Supabase project to create the tables, then `schema_update.sql` for the confirmation system.

### Run

```bash
npm run dev
```

App runs at `http://localhost:5173`.

---

## Environment variables

| Variable                   | Description                 |
| -------------------------- | --------------------------- |
| `PUBLIC_SUPABASE_URL`      | Supabase project URL        |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public)  |
| `SIGHTENGINE_API_USER`     | Image moderation — optional |
| `SIGHTENGINE_API_SECRET`   | Image moderation — optional |

See `.env.example` for the full list.

---

## How it works

### Confirmation system

To prevent spam, a new report starts as `pending` and only becomes public after **3 independent confirmations** from different IPs. IPs are SHA-256 hashed immediately — no raw addresses are ever stored.

### Status pipeline

```
pending → reported → wanksyd → filled
```

- **pending** — awaiting 3 confirmations
- **reported** — live on the map, needs city attention
- **wanksyd** — someone physically flagged it and submitted a city service request
- **filled** — city patched it

### Ward heatmap

The map includes an optional ward heatmap showing pothole density by ward across all three cities. Hovering a ward shows the councillor's name and the active hole count. Clicking through the pothole detail page lets you email the councillor directly.

### Geofence

Reports are restricted to the Waterloo Region boundary (lat 43.32–43.53, lng -80.59 to -80.22). Submissions outside that range are rejected.

---

## Privacy

- No accounts, no cookies, no tracking
- GPS coordinates are stored only to place the pin — no movement data
- IP addresses are SHA-256 hashed on arrival and never stored in raw form
- Map tiles served by OpenStreetMap; reverse geocoding by Nominatim

See [fillthehole.ca/about#privacy](https://fillthehole.ca/about#privacy) for the full policy.

---

## Contributing

Issues and PRs welcome. If you're adding a feature, open an issue first to discuss it — this is a focused civic tool, not a general platform.

---

## License

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0)

Open source. Anyone can use, modify, and run this — but if you distribute a modified version or run it as a hosted service, you must also publish your source code under the same license.
