# Neighbourhood Loop — Ward Alerts + Before/After Fills

**Date:** 2026-07-08
**Status:** Design — awaiting review before implementation plan
**Strategic lens:** Engagement & retention (chosen by product owner)
**Related issues:** #198 (reported_at timestamp — prerequisite), #204 (push subscribe reliability — prerequisite), #199 (before/after doc-drift — Part B resolves it)

## Objective

Two features that together close the "neighbourhood loop" for an account-less civic app:

- **Part A — Ward alerts:** let a resident subscribe to a council ward and get a push notification when a *new* pothole goes live there. The only feature that gives someone a recurring, personal reason to return without an account.
- **Part B — Before/after fills:** capture an optional "after" photo when a pothole is marked filled, and render a before/after split on the detail page. Closes the satisfying "watch it get fixed" loop and produces shareable content.

Part A enriches the moment a pothole *appears*; Part B enriches the moment it is *fixed*.

## Constraints (what shapes every decision)

1. **No user accounts.** Identity is IP-hash (dedup) + anonymous browser push endpoints only. Every retention hook runs on `localStorage` + push subscriptions — never a login.
2. **Privacy-first.** Ward-level (chosen over radius) stores *no* user location — only a `ward_key` string bound to an anonymous push endpoint.
3. **Reuse shipped infrastructure.** Web Push (`push_subscriptions`, VAPID, `webpush.ts`), the per-pothole fill-subscription pattern (`pothole_fill_subscriptions`), the photo pipeline (moderation + EXIF strip + `photos_published`), and the ward geo helpers (`inWardFeature`, `lookupWard`, `${city}-${ward}` keys) all already exist.

---

## Part A — Ward alert subscriptions

### Data model

One new table, mirroring `pothole_fill_subscriptions` almost exactly:

```sql
-- schema_ward_subscriptions.sql
create table ward_subscriptions (
    id         uuid        primary key default gen_random_uuid(),
    ward_key   text        not null,          -- '${city}-${ward}', e.g. 'kitchener-6'
    endpoint   text        not null,
    p256dh     text        not null,
    auth       text        not null,
    created_at timestamptz not null default now(),
    unique (ward_key, endpoint)
);
alter table ward_subscriptions enable row level security;
-- service-role only (push keys are device identifiers); no anon policy.
create index ward_subscriptions_ward_idx on ward_subscriptions (ward_key);
```

`ward_key` is validated on write against the known set derived from `COUNCILLORS` (25 wards: Kitchener 1–10, Waterloo 1–7, Cambridge 1–8). No free-form values.

### Subscribe / unsubscribe API

New route `src/routes/api/notify/ward/+server.ts`, modelled on the existing `api/notify/[id]` handler:

- `POST` — body `{ ward_key, endpoint, keys: { p256dh, auth } }`. Zod-validate; `ward_key` must be one of the known keys. Upsert on `(ward_key, endpoint)`. Rate-limited under a new scope `ward_notify_subscribe` (extend the `api_rate_limit_events_scope_check` constraint — the same one-line migration pattern used for `fill_notify_subscribe`).
- `DELETE` — body `{ ward_key, endpoint }`. Remove the row.

Both use the service-role client (RLS locks the table).

### Fan-out (the notify trigger)

The hook is the exact moment a pothole crosses `pending → reported`. In `src/routes/api/report/+server.ts`, after `increment_confirmation` returns `status = 'reported'`:

1. Resolve the pothole's ward: `fetchWards()` (already memoised in `wards.ts`) + `inWardFeature(lng, lat, geometry)`. Reusing the cached geometry avoids a per-report `lookupWard` ArcGIS round-trip; a cache miss falls back to `lookupWard`.
2. Call a new `notifyWardSubscribers(wardKey, payload)` in `src/lib/server/webpush.ts`, alongside the existing broadcast. Payload: short title + body ("New pothole reported in Ward 6") linking to the pothole detail page.

Best-effort and non-blocking: wrapped so a push failure never fails the report. Uses `logError` on failure (per #203/#204 discipline — no silent swallow). `notifyWardSubscribers` reuses the existing `Promise.allSettled` + 410/404 expired-endpoint pruning that `notifyFillSubscribers` already implements.

**Known tradeoff — write-path latency.** Serverless can't reliably run un-awaited work after the response, so the fan-out must be awaited inside the report handler, adding ward-lookup + push-send time to the *confirming* user's request. For a popular ward with many subscribers, `Promise.allSettled` over N endpoints could be slow. v1 accepts this (fan-out only fires on the rare `pending → reported` promotion, not every report). **Escape hatch:** if it proves too slow, move fan-out to a `pg_cron` sweep keyed on the new `reported_at` column (#198) with a "last notified" watermark — fully decoupling notifications from the write path. This is why Part A sequences after #198.

**Anti-spam:** the 2-confirmation gate naturally throttles fan-out (one notification per pothole, only when it goes live). No digest batching in v1. A subscriber is notified at most once per pothole (enforced implicitly: fan-out fires once, at promotion).

### UI

- **Ward stats page** (`/stats/ward/[city]/[ward]`): a "🔔 Alert me to new potholes in this ward" toggle button. Reuse the `subscribeFillNotification`/`unsubscribeFillNotification` logic from `hole/[id]/+page.svelte:78-120` verbatim as the template — it already handles `swRegistration`, `pushManager.getSubscription()`, `res.ok`, and `Notification.permission === 'denied'` correctly.
- **`localStorage` mirror** `ward-notify:<ward_key>` drives button state, consistent with `hit:` / `fill-notify:` patterns.
- Optionally a compact ward picker on `/stats`, so users can subscribe without navigating to each ward page. (v1 can ship the per-ward-page toggle only; the picker is a fast follow.)

### Cleanup

No new cron for v1. Expired endpoints are pruned during send (410/404), same as fill subscriptions. A future TTL sweep can be added if orphan accumulation proves real.

### Prerequisites

- **#204** — the push subscribe path must check `res.ok` before declaring success, or ward subscriptions silently fail. The `hole/[id]` template already does this correctly; ensure the ward UI copies that, not the broken `PushNotifications.svelte` pattern.
- **#198** — adds the `reported_at` column and touches the same `pending → reported` promotion path; fan-out slots in there cleanly. Sequence Part A after #198.

---

## Part B — Before/after fill verification

### No schema change

`pothole_photos` rows already carry `created_at`. The before/after split is a pure **read-time classification** against `potholes.filled_at`:

- photo `created_at < filled_at` → **before**
- photo `created_at >= filled_at` → **after**

This is exactly the rule CLAUDE.md already documents (and issue #199 flags as unimplemented). Building it makes the docs true.

### Fill flow (capture the after-photo)

After a successful `POST /api/filled`, the client shows an **optional, non-blocking** prompt: *"Nice — add an 'after' photo to show it fixed?"* → routes into the existing `POST /api/photos` (multipart `photo` + `pothole_id`). Moderation, EXIF stripping, magic-byte validation, and rate limiting all already apply unchanged.

**Optional by design:** gating the fill on a photo would tank the "mark it fixed" conversion, which is the action the whole site is trying to encourage. The prompt is an invitation, dismissible.

### Detail-page render

On `hole/[id]/+page.svelte`: when the pothole is `filled` **and** has at least one *approved + published* before photo and one after photo, render a before/after split (side-by-side on desktop, stacked on mobile, each labelled with its date). Otherwise fall back to today's flat gallery. The split derives entirely from the existing `photos` array + `pothole.filled_at` — no new server data.

### Admin / moderation

Unchanged. Photos still require the `photos_published` admin toggle before public display; before/after respects it. No new admin surface.

### Stretch (out of scope for this bundle)

An OG-card "fixed" variant that shows the after-photo for shareable before/after posts via the Bluesky bot. Noted, not built here.

---

## Cross-cutting

- **Migrations:** one new `schema_ward_subscriptions.sql` + the `ward_notify_subscribe` scope-check extension. Update the CLAUDE.md migration list, the pg_cron list (none added), the Project Structure (new `api/notify/ward` route), and Key Business Rules. No new env vars.
- **Docs reconciliation:** Part B resolves the before/after half of #199 — update CLAUDE.md's "Before/after photos" rule from aspirational to accurate, and note it's implemented.
- **Error handling:** all new server paths use `logError`; push fan-out is best-effort but logged, never silently swallowed.
- **Testing:**
  - E2E: ward subscribe → button state persists; unsubscribe. Before/after split renders when a filled pothole has both photo eras (fixture mode).
  - Unit: `notifyWardSubscribers` selects only the target ward's endpoints; before/after classification boundary (`created_at` exactly at `filled_at`).

## Out of scope (YAGNI)

Radius/point subscriptions, account or subscription-management dashboard, required fill photos, email digests, OG "fixed" card, per-ward digest batching.

## Decisions already made

| Decision | Choice | Why |
|----------|--------|-----|
| Area granularity (A) | Ward-level | Reuses ward polygons; stores no user location (privacy) |
| Fan-out mechanism (A) | In-request best-effort at promotion | Instant, simple; cron sweep is the fallback if flaky |
| After-photo (B) | Optional, non-blocking | Protects fill conversion |
| Before/after storage (B) | No schema change; read-time split | `created_at` vs `filled_at` already suffices |

## Suggested rollout sequence

1. Land prerequisites #204 (push `res.ok`) and #198 (`reported_at`).
2. **Part B** first — smaller, no new table, resolves a doc-drift finding, immediate user-visible payoff.
3. **Part A** — table + API + fan-out + ward-page toggle, then the optional stats ward picker.
