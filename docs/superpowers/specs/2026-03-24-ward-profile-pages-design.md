# Ward Profile Pages — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Phase:** 7

## Problem

The stats page has a ward leaderboard with grades, fill rates, and avg resolution times, but there is no shareable URL per ward. A journalist covering Ward 9 Kitchener's accountability record, or a councillor sharing their own grade, has no permalink to point to. The entire ward story is buried in a scrollable aggregate page.

## Goal

Shareable, linkable accountability pages per ward councillor — one URL per ward that shows that ward's grade, stats, open potholes, and monthly trend.

## Non-Goals

- No new database tables
- No authenticated features
- No editing or moderation from these pages
- No councillor-submitted data

## Route

```
/stats/ward/[city]/[ward]
```

Examples:
- `/stats/ward/kitchener/9`
- `/stats/ward/waterloo/3`
- `/stats/ward/cambridge/2`

**Validation:** `city` must be one of `kitchener | waterloo | cambridge`. `ward` must be a positive integer matching a known councillor entry in `COUNCILLORS`. Invalid combinations throw `error(404, 'Ward not found')`.

## Data Loading (`+page.server.ts`)

1. Validate `city` and `ward` params against the `COUNCILLORS` array. Throw 404 if no match.
2. Call `fetchWards(city)` from `$lib/wards` to get the GeoJSON feature collection for that city's wards. This uses the internal ArcGIS cache already in `wards.ts` and avoids an HTTP round-trip to `/api/wards.geojson`. Find the specific ward feature matching `ward` number. (Note: `fetchWards` is currently module-private — it must be exported as part of this feature's implementation.)
3. If the ward feature cannot be fetched, throw `error(503, 'Ward boundary data unavailable')` — do not fall back to unfiltered data, as showing all-region potholes for a single ward page would be actively misleading.
4. Fetch all potholes from `potholes` table with `status IN ('reported', 'filled', 'expired')` via the anon Supabase client (public read, consistent with the stats page). Apply `decodeHtmlEntities` to `address` and `description` fields before returning, matching the pattern in `hole/[id]/+page.server.ts`.
5. Filter potholes to those within the matched ward boundary using `inWardFeature` from `$lib/geo`.
6. Return: `{ councillor, wardPotholes, origin }` — computation of grade/stats/chart data happens in the Svelte component via `$derived`, consistent with the stats page pattern.

## Page Sections (Layout A)

### 1. Header
- Back link → `/stats`
- Councillor avatar: circle with first initial, sky-500 background
- Councillor name (large), ward number, city (subdued)
- Grade pill (same colour coding as stats page: A=green, B=sky, C=yellow, D/F=red)

### 2. Stat Pills (3-up grid)
- **Reported** — total confirmed potholes ever in this ward
- **Filled** — total filled
- **Open** — potholes with `status = 'reported'` OR `status = 'expired'` (matches the stats page definition of "open")

### 3. Mini Bar Chart
- Last 12 months of reports vs fills
- Same CSS `height`-based bar approach as the existing stats page monthly chart
- Orange = reported, green = filled
- Month labels every 3rd column

### 4. Open Potholes List
- All potholes with `status = 'reported'`, sorted by `created_at` ascending (oldest first — most urgent)
- Each row: address (or lat/lng fallback) · days open · link to `/hole/[id]`
- Show up to 10; if more exist, show "View all on map" link
- Empty state: "No open potholes in this ward right now."

### 5. Actions
- **Email councillor** — uses a ward-level mailto built inline (not the `getEmailUrl` from `hole/[id]/+page.svelte` which requires a `Pothole` object). Subject: `Pothole situation in Ward {ward}`; body includes fill rate, open count, and ward page URL.
- **Councillor page** — external link to `councillor.url`
- **Back to all wards** → `/stats#ward-heading`

## Email Utility Extraction

`getEmailUrl` is currently a local function inside `src/routes/hole/[id]/+page.svelte`. To avoid duplication, extract it to `src/lib/email.ts` as an overloaded helper:

```ts
// Ward-level email (no specific pothole)
export function getWardEmailUrl(councillor: Councillor, fillRate: number, openCount: number, wardUrl: string): string

// Pothole-level email (existing behaviour, moved here)
export function getPotholeEmailUrl(councillor: Councillor, pothole: Pothole): string
```

Update `hole/[id]/+page.svelte` to import from `$lib/email` instead of the local function.

## Grade Computation

Reuse the exact grade algorithm from the stats page (`wardGrade` function):
- Fill rate weight: 70%
- Avg response time weight: 30%
- Thresholds: A ≥ 80, B ≥ 60, C ≥ 40, D ≥ 20, F < 20
- Wards with fewer than 5 total potholes return `'—'` (insufficient data)

The ward page computes this via `$derived` from `wardPotholes`, identical to how the stats page computes it per ward in the leaderboard. Extract the `wardGrade` function to `$lib/ward-grade.ts` so both the stats page and the ward profile page import the same implementation.

## OG Image (`/api/og/ward/[city]/[ward]`)

New endpoint following the existing `/api/og/[id]` pattern (Satori + `@fontsource/barlow-condensed`).

**Required:** Must set `'Cross-Origin-Resource-Policy': 'cross-origin'` in the response headers, matching the existing OG endpoint — without this, the global `same-site` CORP policy set in `hooks.server.ts` will block social media crawlers from loading the image.

Renders:
- Ward grade (large, colour-coded)
- Councillor name
- City + ward label
- Fill rate %
- "fillthehole.ca" wordmark

Referenced in `<svelte:head>` on the ward page:
```html
<meta property="og:image" content="{origin}/api/og/ward/{city}/{ward}" />
```

## Navigation Changes

- Stats page ward table: each row's city+ward cells become `<a href="/stats/ward/{city}/{ward}">` links
- No nav bar changes needed (ward pages are discoverable via stats)

## Error Handling

- Invalid `city` or `ward` param → `error(404, 'Ward not found')`
- Ward boundary fetch failure → `error(503, 'Ward boundary data unavailable')` — never fall back to unfiltered data
- Empty ward (no potholes yet) → show zero-state for each section gracefully
- OG image: invalid city/ward → 404; boundary fetch failure → 503

## Testing

- E2E spec: `tests/e2e/ward-profile.spec.ts`
  - Valid ward page loads with correct councillor name and grade
  - Invalid city returns 404
  - Invalid ward number returns 404
  - Stats page ward rows link to correct ward URLs
  - OG image endpoint returns 200 with `image/png` content-type
- Reuse E2E fixture pattern from `pothole-detail.spec.ts` — add a ward fixture to `+page.server.ts`

## File Plan

```
src/lib/
  email.ts            — extracted getWardEmailUrl + getPotholeEmailUrl
  ward-grade.ts       — extracted wardGrade() shared by stats + ward pages

src/routes/stats/ward/[city]/[ward]/
  +page.server.ts     — load, validate, fetch potholes, filter by ward
  +page.svelte        — layout A: header, pills, chart, open list, actions

src/routes/api/og/ward/[city]/[ward]/
  +server.ts          — Satori OG image for ward (with CORP: cross-origin header)

tests/e2e/
  ward-profile.spec.ts

src/routes/stats/+page.svelte       — add href links to ward rows (minor edit)
src/routes/hole/[id]/+page.svelte   — update to import getPotholeEmailUrl from $lib/email
src/lib/wards.ts                    — export fetchWards (currently module-private)
```

## Open Questions

None — all decisions resolved during design.
