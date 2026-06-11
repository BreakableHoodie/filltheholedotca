# Full-Site Audit — Security · SEO · A11y/UX · Performance

**Date:** 2026-06-11
**Base:** `origin/main` @ `e92c759`
**Method:** Four parallel read-only audit passes (Security, SEO, Accessibility/UX, Performance/PSI), then consolidated triage.
**Implementation:** one PR per domain, security first. This document is the umbrella record; each PR references it.

| Domain | Branch | Lead severity |
|--------|--------|---------------|
| Security | `fix/security-audit-deps-rls` | High (pending-row enumeration) |
| SEO | `feat/seo-audit-fixes` | Medium |
| A11y / UX | `fix/a11y-ux-audit` | Medium (contrast failures) |
| Performance / PSI | `perf/psi-critical-path` | Medium (critical-path JS) |

Disposition legend: **[FIXED]** landed in this PR · **[PLANNED]** scheduled for the named domain PR · **[DEFERRED]** intentionally out of scope, rationale given.

---

## Security

### [FIXED] potholes "Public read" RLS exposes `pending` rows to the anon key — High

`schema.sql:39-41` defines `create policy "Public read" on potholes for select using (true)`, and no later migration overrides it. PostgREST enforces RLS row predicates but **not** the app's `.neq('status','pending')` query filter, so anyone with the public anon key can enumerate every unconfirmed report:

```
GET /rest/v1/potholes?status=eq.pending
```

This leaks single-reporter submissions (and their rounded-but-still-real coordinates) before the 2-confirmation gate makes them public.

**Fix (this PR):**
- `schema_pending_rls.sql` — drops `"Public read"`, recreates as `"Public read non-pending"` with `using (status <> 'pending')`.
- `src/routes/hole/[id]/+page.server.ts` — the post-report self-tracking view (`/hole/<id>?submitted=1`, reached via `report/+page.svelte:424`) reads the pothole row. Switched its single-row read from the anon client to `getAdminClient()` (service role, bypasses RLS, non-enumerable by exact UUID) so a freshly-submitted pending report still resolves instead of 404ing. This mirrors the existing `/api/watchlist` model.
- `CLAUDE.md` — migration list step 23 + a Key Business Rules note.

**Manual step required before deploy:** apply `schema_pending_rls.sql` to the live Supabase project. The PR ships SQL only; it does not touch the running database.

> Numbering note: the user's in-flight `docs/readme-badges` work adds `schema_grants.sql` as step 23. That file is not on `origin/main`, so this branch also numbers its migration 23 — renumber whichever lands second. `schema_grants.sql:21` currently carries a comment claiming the read policy "filters pending rows," which was false before this change and becomes true after it; correct the comment when the two branches reconcile.

### [DEFERRED] Dependency vulnerabilities — already remediated upstream

The audit flagged devalue (GHSA-77vg-94rm-hx3p), svelte (4 moderate), `@sveltejs/kit` (GHSA-hgv7-v322-mmgr), and ws. All corresponding Dependabot bumps merged to `main` while the audit was paused; `npm audit` and `npm audit --omit=dev` both report **0 vulnerabilities** on `e92c759`. No action.

### [DEFERRED] `/api/watchlist` returns pending rows by UUID — intentional

Reporter self-tracking. Reads through `getAdminClient()` (service role) by validated UUID only, max 50 ids, no enumeration surface. Documented, not changed.

---

## SEO — [PLANNED] `feat/seo-audit-fixes`

| Severity | File | Finding |
|----------|------|---------|
| Med | `static/robots.txt` | `Disallow: /api/` blocks OG images, `export.csv`, `feed.xml`, `feed.json` from crawlers. Replace with allow-list for `/api/og/`, open-data routes; `Disallow: /admin/`; add `Sitemap:` line. |
| Med | `src/app.html` | Global `<meta name="description">` duplicates the per-route one SvelteKit appends via `%sveltekit.head%`. `lang="en"` → `en-CA`. Missing `preconnect` for `tile.openstreetmap.org`. |
| Med | `src/routes/sitemap.xml/+server.ts:7-12` | Missing `/report` (priority 0.9) and per-ward pages derived from `COUNCILLORS` in `$lib/wards`. |
| Med | `src/routes/+layout.svelte` | No `twitter:card`; no RSS/JSON feed autodiscovery `<link rel="alternate">`. |
| Low | `src/routes/hole/[id]/+page.server.ts` | `og:url` built from request origin → use a `SITE_URL` constant for canonical stability. |
| Low | `src/routes/hole/[id]/+page.svelte:401` | Add `Dataset` JSON-LD (open-data signal); reuse the existing safe `JSON.stringify` + `</script` neutralization pattern already there. |

Default OG image must be a satori route (`/api/og/default`, reuse `og-helpers`) — **not** a static PNG (CLAUDE.md forbids binary assets in git).

---

## Accessibility / UX — [PLANNED] `fix/a11y-ux-audit`

| Severity | File | Finding |
|----------|------|---------|
| High | `src/lib/constants.ts:18-21` | `STATUS_CONFIG` zinc-era colors (`text-orange-400`, `text-green-400`) fail 4.5:1 in light mode. Convert to light/dark pairs (`text-orange-700 dark:text-orange-400`). |
| High | `src/routes/report/+page.svelte:639-646` | Severity radios have invisible focus indicator — keyboard users can't see selection focus. |
| Med | `src/routes/report/+page.svelte:559-564` | iOS address-suggestion `onblur`/`relatedTarget` dismisses the list before the tap registers; switch to `pointerdown`/`mousedown` selection. |
| Med | `src/routes/report/+page.svelte:40-48` | `resizeImage` throws uncaught on HEIC → silent failure with no user feedback. |
| Med | `src/routes/hole/[id]/+page.svelte:376-385` | Un-awaited share/clipboard promise; mirror the correct pattern at `+page.svelte:411-432`. |
| Med | `src/routes/hole/[id]/+page.svelte:651,703,893,923` | Card titles are `<div>`s, not `<h2>` — breaks heading outline. |
| Med | `src/routes/how-to/+page.svelte:84` | Wrong instructional copy: "from a different location" → confirmation requires a *different person, same spot*. Also dev jargon (`:99`), stale crosshair step (`:72`), label mismatch (`:115`). |
| Med | `src/routes/stats/+page.svelte` | Multiple contrast failures (`:245,265-281,380-382,474-481,518-519`) and `hover:text-white` on light bg (`:417,426,435`). |
| Med | `+page.svelte`, `hole/[id]`, several | Motion (flyTo, smooth scroll) needs `prefers-reduced-motion` guards. |
| Low | `PushNotifications.svelte`, `WatchlistPanel.svelte`, `HomeIntroCard.svelte`, `+error.svelte` | Bell/CTA contrast, tiny tap targets, missing retry/silent-failure handling. |

Header CTA at `+layout.svelte:~90` (`bg-amber-500 text-stone-900`, ≈7.6:1) is the **correct** pattern — reuse it for the white-on-amber CTAs at `+page.svelte:578,618,701` and `hole/[id]:663`.

---

## Performance / PSI — [PLANNED] `perf/psi-critical-path`

| Severity | File | Finding |
|----------|------|---------|
| Med | `src/hooks.client.ts` | `Sentry.init` runs synchronously (~16.4 kB gz) on every page's critical path. Defer to `requestIdleCallback` with an error buffer. |
| Med | `src/routes/+page.svelte:300-306` | Four serial `await import()` for the Leaflet stack → module-scope, browser-guarded `Promise.all`. |
| Med | `src/routes/+page.svelte:358-401` | Eager `bindPopup(html)` for every marker → `bindPopup(() => html)` lazy + batch `addLayers`. |
| Med | `src/routes/+page.svelte:2,289` | Static `import * as Sentry` used only in one catch → dynamic import. |
| Med | `src/routes/api/wards.geojson/+server.ts:26-36` | ArcGIS response 374 kB / 4.5 s cold; add `&geometryPrecision=5`. |
| Low | `src/routes/+page.svelte:334` | `{s}.tile.openstreetmap.org` subdomain sharding is an HTTP/2 anti-pattern → single host. |
| Low | `src/routes/+page.server.ts:23` | Drop unused `filled_at`/`expired_at` from the homepage select. |
| Low | `src/routes/+layout.svelte:12-26` | Drop unused Public Sans 500/600/700 preloads; add `barlow-condensed-latin-800-normal.woff2` (~22.5 kB) used by the brand wordmark. |
| Low | `src/routes/hole/[id]/+page.server.ts:183-184` | Photo `<img>` missing width/height + webp; add Supabase `preconnect`. |

Baseline (good, no action): immutable hashed-asset caching correct; `supabase-js` correctly server-only; Leaflet lazy-loaded at 43 kB gz.

---

## Explicitly deferred (all domains)

BreadcrumbList/FAQPage JSON-LD · `HomeIntroCard` SSR-flip (flicker risk) · full map keyboard operability · mobile tool-tray redesign · `sw.js` changes · `icon-512.png` recompression · Cloudflare cache rules · CLAUDE.md note that Barlow Condensed is both the OG **and** client brand font (cosmetic doc fix, folded into the perf PR's font work).
