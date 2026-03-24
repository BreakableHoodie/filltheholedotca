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
- `/stats/cambridge/2`

**Validation:** `city` must be one of `kitchener | waterloo | cambridge`. `ward` must be a positive integer matching a known councillor entry. Invalid combinations return 404.

## Data Loading (`+page.server.ts`)

1. Validate `city` and `ward` params against the `COUNCILLORS` array. Throw 404 if no match.
2. Load ward GeoJSON boundaries via the existing `/api/wards.geojson` endpoint (same fetch used by the stats page's `onMount`). Alternatively, import the ward boundary data server-side directly to avoid an HTTP round-trip.
3. Fetch all potholes from `potholes` table with `status IN ('reported', 'filled', 'expired')` — same query shape as the main stats page.
4. Filter potholes to those within the matched ward boundary using `inWardFeature` from `$lib/geo`.
5. Return: `{ councillor, wardPotholes, origin }` — computation of grade/stats/chart data happens in the Svelte component via `$derived`, consistent with the stats page pattern.

## Page Sections (Layout A)

### 1. Header
- Back link → `/stats`
- Councillor avatar: circle with first initial, sky-500 background
- Councillor name (large), ward number, city (subdued)
- Grade pill (same colour coding as stats page: A=green, B=sky, C=yellow, D/F=red)

### 2. Stat Pills (3-up grid)
- **Reported** — total confirmed potholes ever in this ward
- **Filled** — total filled
- **Open** — currently `reported` status (unfilled)

### 3. Mini Bar Chart
- Last 12 months of reports vs fills
- Same CSS `height`-based bar approach as the existing stats page monthly chart
- Orange = reported, green = filled
- Month labels every 3rd column

### 4. Open Potholes List
- All potholes with `status = 'reported'`, sorted by `created_at` ascending (oldest first — most urgent)
- Each row: address (or lat/lng fallback) · days open · link to `/hole/[id]`
- Show up to 10, with "View all on map" link to `/?ward=[city]-[ward]` if more exist (future)
- Empty state: "No open potholes in this ward right now."

### 5. Actions
- **Email councillor** — reuses `getEmailUrl(councillor, pothole=null)` with a ward-level subject/body (no specific pothole)
- **Councillor page** — external link to `councillor.url`
- **Back to all wards** → `/stats#ward-heading`

## Grade Computation

Reuse the existing grade algorithm from the stats page:
- Fill rate weight: 70%
- Avg response time weight: 30%
- Thresholds: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, F < 40

The ward page computes this via `$derived` from `wardPotholes`, identical to how the stats page computes it per ward in the leaderboard.

## OG Image (`/api/og/ward/[city]/[ward]`)

New endpoint following the existing `/api/og/[id]` pattern (Satori + `@fontsource/barlow-condensed`).

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

- Invalid `city` or `ward` param → SvelteKit `error(404, 'Ward not found')`
- Ward GeoJSON fetch failure → fall back to loading all potholes without geographic filtering, show a warning banner
- Empty ward (no potholes) → show zero-state for each section gracefully

## Testing

- E2E spec: `tests/e2e/ward-profile.spec.ts`
  - Valid ward page loads with correct councillor name
  - Invalid city/ward returns 404
  - Stats page ward rows link to correct ward URLs
  - OG image endpoint returns 200 with correct content-type
- Reuse E2E fixture pattern from `pothole-detail.spec.ts` — add a ward fixture to `+page.server.ts`

## File Plan

```
src/routes/stats/ward/[city]/[ward]/
  +page.server.ts     — load, validate, fetch potholes, filter by ward
  +page.svelte        — layout A: header, pills, chart, open list, actions

src/routes/api/og/ward/[city]/[ward]/
  +server.ts          — Satori OG image for ward

tests/e2e/
  ward-profile.spec.ts

src/routes/stats/
  +page.svelte        — add href links to ward rows (minor edit)
```

## Open Questions

None — all decisions resolved during design.
