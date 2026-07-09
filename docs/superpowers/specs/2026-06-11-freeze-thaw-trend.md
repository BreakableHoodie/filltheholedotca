> **Status: Shipped** — implemented; retained for historical context.

# Spec: Freeze–Thaw Trend Overlay

**Date:** 2026-06-11
**Status:** Proposed
**Surface:** `/stats` — enriches the existing "Monthly activity" chart

## Context & goal

Potholes in Waterloo Region are a freeze–thaw artifact: water enters pavement cracks, freezes and expands, thaws, and the road fails. The number of **freeze–thaw days** in a month is the best single predictor of pothole formation. We already chart monthly reports/fills on `/stats`; overlaying a freeze–thaw line on that same chart turns it from a tally into an explanatory, data-journalism-grade view — "report spikes follow the freeze–thaw curve."

This is the cheapest path from the current map/tally product toward an analytical instrument, and it needs **no API key, no new env var, and no manual data entry**.

### Non-goals (v1)
- No map timeline scrubber (stays on `/stats`).
- No per-pothole weather attribution.
- No forecasting/prediction yet (that's a natural follow-up once the historical correlation is visible).

## Data source

**Open-Meteo Historical Weather API** — free, no key, 10k calls/day non-commercial (this is a free civic project → compliant).

```
GET https://archive-api.open-meteo.com/v1/archive
  ?latitude=43.46&longitude=-80.52        # Waterloo Region centroid (one point is fine for a regional trend)
  &start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
  &daily=temperature_2m_max,temperature_2m_min
  &timezone=America/Toronto
```

Returns `daily.time[]`, `daily.temperature_2m_max[]`, `daily.temperature_2m_min[]`.

**Freeze–thaw day** := `tmin < 0 °C AND tmax > 0 °C`.

Caveats to encode:
- ERA5 reanalysis lags ~5 days, so the current month is slightly incomplete — acceptable for a monthly aggregate; note it in a tooltip/caption.
- Single centroid point approximates the whole region — fine at monthly resolution.
- Graceful degradation: if the fetch fails, the chart renders **without** the freeze–thaw line (never blocks the page).

## Architecture

No new public API route — the data flows through the existing SSR stats loader, matching how `monthlyData` already works.

### 1. `src/lib/server/weather.ts` (new)

```ts
// Pure, unit-testable: given Open-Meteo daily arrays + the month keys the stats
// page uses, return { 'YYYY-MM': freezeThawDayCount }.
export function computeFreezeThawByMonth(
  daily: { time: string[]; tmax: number[]; tmin: number[] },
  monthKeys: string[]
): Record<string, number>;

// Fetch (module-level cache, ~12h TTL) + compute. Returns {} on any failure
// after logError('weather', ...). Mirrors the cache pattern in
// api/wards.geojson/+server.ts. `months` is clamped (1..36) — no user-controlled
// URL input, so no SSRF surface; still uses a fetch timeout.
export async function getFreezeThawByMonth(months: number): Promise<Record<string, number>>;
```

- Validate the Open-Meteo response shape with zod before use (defensive — untrusted external input).
- Cache key = `${startMonth}..${endMonth}`; weather history is immutable once past, only the current month grows, so a 12h TTL is plenty and keeps us to a handful of calls/day.

### 2. `src/routes/stats/+page.server.ts` (edit)

Call `getFreezeThawByMonth(18)` and add `freezeThawByMonth` to the returned object. Keep it best-effort — wrap so a weather failure never fails the stats load.

### 3. `src/routes/stats/+page.svelte` (edit)

- Merge `data.freezeThawByMonth` into the existing `monthlyData` derived (add `freezeThaw: number` per month, keyed by the same `YYYY-MM`).
- **Chart:** overlay a line (freeze–thaw days/month) on the existing reported/filled bars, scaled to its own max with a second faint axis label. Add a legend entry next to the existing Reported/Filled swatches.
- **Accessibility (WCAG 1.1.1):** add a "Freeze–thaw days" column to the existing `sr-only` `<table>` fallback, and update the chart's `aria-label`. Use the light/dark contrast-safe tokens established in the a11y PR (no `text-orange-400`-style single-mode colors).

## Security / privacy / docs

- **No PII**, no env var, no key. Fixed external host, no user input in the URL → no SSRF.
- **CLAUDE.md:** add `lib/server/weather.ts` to the structure list and note Open-Meteo as an external data source (no key, cached, graceful-degrading). No `.env.example` change.

## Testing

- `tests/unit/weather.spec.ts`: drive `computeFreezeThawByMonth` with fixture temp arrays — assert classification (`-3/+2` → freeze–thaw; `-5/-1` → not; `+1/+8` → not) and correct month bucketing across a year boundary. No network in tests (pure function).

## Build sequence

1. `lib/server/weather.ts` + unit tests.
2. Wire into `stats/+page.server.ts` (best-effort).
3. Chart overlay + SR-table column + legend in `stats/+page.svelte`.
4. CLAUDE.md.
5. Verify: `npm run check`, `npm run build`, `npm run test`, `npm run lint:a11y` → PR.

## Risks

- **External dependency** (Open-Meteo). Mitigated by caching + graceful degradation.
- **~5-day reanalysis lag** → current month slightly low; disclose in caption.
- **Single-point approximation** → acceptable at monthly resolution; revisit if we ever go per-pothole.

## Natural follow-ups (not v1)

- Predictive view: pair freeze–thaw with pavement age/resurfacing data (if obtainable) to forecast hotspots.
- Region road-network enrichment (jurisdiction routing + road-segment unit).
