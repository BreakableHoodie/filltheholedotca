# Neighbourhood Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two account-less engagement features — ward-level "new pothole near me" push alerts, and an optional after-photo on fill with a before/after split on the detail page.

**Architecture:** Part B (before/after) is a pure read-time split of the existing photo list against `filled_at` plus a reused upload prompt — no schema change. Part A (ward alerts) adds one `ward_subscriptions` table, a `/api/notify/ward` route modelled on the existing per-pothole notify route, a `notifyWardSubscribers` fan-out in `webpush.ts`, and a hook in the report route at the `pending→reported` moment.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TypeScript, Supabase (service-role client), Web Push (`web-push`), zod, Playwright (E2E + `tests/unit/`).

## Global Constraints

- Svelte 5 runes only (`$state`/`$derived`/`$props`/`$effect`) — no Svelte 4 syntax.
- API routes validate input with zod; server errors use `logError(area, msg, err, ctx?)` from `$lib/server/observability` — never bare `console.error`, never a swallowed `error(500)`.
- All pothole writes/reads for subscriptions use the service-role client `getAdminClient()` from `$lib/server/supabase` (RLS locks the tables).
- Push endpoints must pass `isSafePushEndpoint` from `$lib/server/ssrf` before use.
- Ward key format is exactly `` `${city}-${ward}` `` (e.g. `kitchener-6`), cities `'kitchener' | 'waterloo' | 'cambridge'`.
- New migrations are additive SQL files committed to the repo root and appended to the CLAUDE.md migration list in the same task; the plan does NOT apply them to the live DB.
- Commit hook is broken on this repo (`.husky/pre-commit` runs `npx lint-staged` with no config); commit with `--no-verify`. Run `npx svelte-check --tsconfig ./tsconfig.json --threshold error` before each commit instead.
- Tests: E2E under `tests/e2e/*.spec.ts`, unit under `tests/unit/*.spec.ts`, both run via `npx playwright test <path>`.

---

## Phase 1 — Part B: Before/after fills (no prerequisites)

### Task B1: Before/after classification helper

**Files:**
- Create: `src/lib/photo-split.ts`
- Test: `tests/unit/photo-split.spec.ts`

**Interfaces:**
- Produces: `splitByFill<T extends { created_at: string }>(photos: T[], filledAt: string | null): { before: T[]; after: T[] }` — when `filledAt` is null, all photos are `before` and `after` is empty.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/photo-split.spec.ts
import { test, expect } from '@playwright/test';
import { splitByFill } from '../../src/lib/photo-split';

const p = (created_at: string) => ({ id: created_at, created_at });

test('splits photos before/after filled_at', () => {
	const filledAt = '2026-03-10T12:00:00Z';
	const photos = [p('2026-03-01T00:00:00Z'), p('2026-03-10T12:00:00Z'), p('2026-03-15T00:00:00Z')];
	const { before, after } = splitByFill(photos, filledAt);
	expect(before.map((x) => x.id)).toEqual(['2026-03-01T00:00:00Z']);
	// A photo taken exactly at filled_at counts as "after".
	expect(after.map((x) => x.id)).toEqual(['2026-03-10T12:00:00Z', '2026-03-15T00:00:00Z']);
});

test('null filled_at puts everything in before', () => {
	const photos = [p('2026-03-01T00:00:00Z')];
	const { before, after } = splitByFill(photos, null);
	expect(before).toHaveLength(1);
	expect(after).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/unit/photo-split.spec.ts`
Expected: FAIL — cannot find module `../../src/lib/photo-split`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/photo-split.ts
/**
 * Split a chronological photo list into before/after buckets relative to a
 * pothole's fill time. A photo taken exactly at filled_at counts as "after".
 * When filledAt is null (not yet filled) every photo is "before".
 */
export function splitByFill<T extends { created_at: string }>(
	photos: T[],
	filledAt: string | null
): { before: T[]; after: T[] } {
	if (!filledAt) return { before: [...photos], after: [] };
	const fill = new Date(filledAt).getTime();
	const before: T[] = [];
	const after: T[] = [];
	for (const photo of photos) {
		if (new Date(photo.created_at).getTime() < fill) before.push(photo);
		else after.push(photo);
	}
	return { before, after };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/unit/photo-split.spec.ts`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/photo-split.ts tests/unit/photo-split.spec.ts
git commit --no-verify -m "feat(photos): add before/after split helper by filled_at"
```

---

### Task B2: Render before/after split on the detail page

**Files:**
- Modify: `src/routes/hole/[id]/+page.svelte` (photo gallery block near `<!-- Photos -->` at ~line 711; `let photos = $derived(data.photos ?? [])` at ~line 54)
- Test: `tests/e2e/pothole-detail.spec.ts` (add a case; fixture mode)

**Interfaces:**
- Consumes: `splitByFill` from `$lib/photo-split`; `pothole.filled_at`, `pothole.status`, `photos` (each `{ id, created_at, url, thumbnailUrl, moderation_status }`).

- [ ] **Step 1: Add the derived split (Svelte 5 runes) in the `<script>`**

Add after `let photos = $derived(data.photos ?? []);`:

```ts
import { splitByFill } from '$lib/photo-split';

// Before/after only when filled AND both eras have at least one published photo.
let photoSplit = $derived(splitByFill(photos, pothole.filled_at));
let showBeforeAfter = $derived(
	pothole.status === 'filled' && photoSplit.before.length > 0 && photoSplit.after.length > 0
);
```

- [ ] **Step 2: Write the failing E2E test**

```ts
// tests/e2e/pothole-detail.spec.ts  (add this test)
test('filled pothole with before and after photos shows a before/after split', async ({ page }) => {
	// Fixture id whose pothole is filled with one photo created before filled_at
	// and one after. See E2E fixtures in +page.server.ts / fixture-store.
	await page.goto('/hole/00000000-0000-0000-0000-0000000000fa');
	await expect(page.getByRole('heading', { name: /before/i })).toBeVisible();
	await expect(page.getByRole('heading', { name: /after/i })).toBeVisible();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx playwright test tests/e2e/pothole-detail.spec.ts -g "before/after split"`
Expected: FAIL — "Before"/"After" headings not found.

- [ ] **Step 4: Implement the split rendering**

In the `<!-- Photos -->` block, wrap the existing gallery so that when `showBeforeAfter` is true it renders two labelled `<h3>` sections (`Before` → `photoSplit.before`, `After` → `photoSplit.after`), each reusing the exact same thumbnail markup the flat gallery already uses (same `lightboxIndex` open handler, `thumbnailUrl`, `loading="lazy"`, `aspect-video`). When `showBeforeAfter` is false, render today's flat `{#each photos}` grid unchanged.

```svelte
{#if showBeforeAfter}
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<h3 class="section-title text-sm text-stone-500 dark:text-stone-400 mb-2">Before</h3>
			<div class="grid grid-cols-2 gap-2">
				{#each photoSplit.before as photo (photo.id)}
					<!-- reuse the existing thumbnail button markup here, index into `photos` for the lightbox -->
				{/each}
			</div>
		</div>
		<div>
			<h3 class="section-title text-sm text-stone-500 dark:text-stone-400 mb-2">After</h3>
			<div class="grid grid-cols-2 gap-2">
				{#each photoSplit.after as photo (photo.id)}
					<!-- reuse the existing thumbnail button markup here -->
				{/each}
			</div>
		</div>
	</div>
{:else}
	<!-- existing flat gallery unchanged -->
{/if}
```

Note for the implementer: the lightbox uses an index into the flat `photos` array (`prevPhoto`/`nextPhoto` at ~line 286 wrap on `photos.length`). Compute each thumbnail's lightbox index as `photos.indexOf(photo)` so before/after clicks still open the correct lightbox slide.

- [ ] **Step 5: Add the E2E fixture**

Add a fixture pothole with `id: '00000000-0000-0000-0000-0000000000fa'`, `status: 'filled'`, `filled_at` set, `photos_published: true`, and two photos — one `created_at` before `filled_at`, one after — to the fixture source used by `hole/[id]/+page.server.ts` in `PLAYWRIGHT_E2E_FIXTURES` mode (`src/lib/fixture-store.ts` / the server loader's fixture branch). Match the existing fixture shape.

- [ ] **Step 6: Run tests to verify pass**

Run: `npx playwright test tests/e2e/pothole-detail.spec.ts`
Expected: PASS. Then `npx svelte-check --tsconfig ./tsconfig.json --threshold error` → 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/routes/hole/[id]/+page.svelte tests/e2e/pothole-detail.spec.ts src/lib/fixture-store.ts
git commit --no-verify -m "feat(photos): before/after split on filled pothole detail page"
```

---

### Task B3: Optional after-photo prompt on fill

**Files:**
- Modify: `src/routes/hole/[id]/+page.svelte` (`markFilled()` at ~line 343; existing upload UI `uploadPhoto`/`handlePhotoSelect`/`canUploadPhoto` at ~lines 217-269)

**Interfaces:**
- Consumes: existing `markFilled()`, existing photo upload state/handlers.
- Produces: `let promptAfterPhoto = $state(false)` — set true after a successful fill to surface the upload prompt.

- [ ] **Step 1: Add prompt state**

In `<script>`, add: `let promptAfterPhoto = $state(false);`

- [ ] **Step 2: Set it on successful fill**

In `markFilled()`, after the success path (status flips to filled / `invalidateAll()`), add `promptAfterPhoto = true;`. Do not block or gate the fill on a photo.

- [ ] **Step 3: Render the non-blocking prompt**

Near the photo upload UI, when `promptAfterPhoto && pothole.status === 'filled'`, show a dismissible card: heading "Show it's fixed — add an 'after' photo" plus the existing file input / `uploadPhoto` button (reuse the existing controls; do not duplicate upload logic). A "Not now" button sets `promptAfterPhoto = false`.

- [ ] **Step 4: Manual verification (no new automated test — reuses covered upload path)**

Run: `npm run build && npm run preview`, open a reported fixture pothole, click "It's been filled", confirm the after-photo prompt appears and "Not now" dismisses it. Then `npx svelte-check --tsconfig ./tsconfig.json --threshold error`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/hole/[id]/+page.svelte
git commit --no-verify -m "feat(photos): prompt for an after-photo when a pothole is marked filled"
```

---

### Task B4: Reconcile CLAUDE.md before/after claim (closes half of #199)

**Files:**
- Modify: `CLAUDE.md` (Key Business Rules → "Before/after photos")

- [ ] **Step 1: Update the rule wording**

Change the "Before/after photos" bullet so it describes the now-shipped read-time split (`created_at < filled_at` = before) and references `src/lib/photo-split.ts`. Remove any implication that it was already built elsewhere.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit --no-verify -m "docs: mark before/after photo split as implemented (refs #199)"
```

---

## Phase 2 — Part A: Ward alerts

> Recommended before starting: confirm #204's fix (push subscribe checks `res.ok`) is either merged or that Task A6 copies the correct pattern below. #198's `reported_at` column is only needed for the optional cron escape hatch, not for the in-request fan-out this plan implements.

### Task A1: `ward_subscriptions` migration + rate-limit scope

**Files:**
- Create: `schema_ward_subscriptions.sql` (repo root)
- Modify: `CLAUDE.md` (migration list — add as the next numbered step)

- [ ] **Step 1: Write the migration**

```sql
-- schema_ward_subscriptions.sql
-- Ward-level "new pothole" push subscriptions. Each row binds an anonymous
-- browser push subscription to one council ward. Service-role only.
create table ward_subscriptions (
    id         uuid        primary key default gen_random_uuid(),
    ward_key   text        not null,
    endpoint   text        not null,
    p256dh     text        not null,
    auth       text        not null,
    created_at timestamptz not null default now(),
    unique (ward_key, endpoint)
);
alter table ward_subscriptions enable row level security;
create index ward_subscriptions_ward_idx on ward_subscriptions (ward_key);

grant select, insert, delete on ward_subscriptions to service_role;

-- Extend the rate-limit scope constraint to allow the new scope.
alter table api_rate_limit_events drop constraint if exists api_rate_limit_events_scope_check;
alter table api_rate_limit_events add constraint api_rate_limit_events_scope_check
  check (scope in (
    'report','filled','photo_upload','hit','fill_notify_subscribe',
    'push_unsubscribe','ward_notify_subscribe'
  ));
```

Implementer note: copy the EXACT current scope list from the latest `schema_*ratelimit*.sql` before adding `ward_notify_subscribe`, so no existing scope is dropped.

- [ ] **Step 2: Append to the CLAUDE.md migration list**

Add the new numbered migration entry describing `schema_ward_subscriptions.sql`.

- [ ] **Step 3: Commit**

```bash
git add schema_ward_subscriptions.sql CLAUDE.md
git commit --no-verify -m "feat(db): ward_subscriptions table + ward_notify_subscribe rate-limit scope"
```

---

### Task A2: Ward-key set + validation helper

**Files:**
- Modify: `src/lib/wards.ts`
- Test: `tests/unit/ward-keys.spec.ts`

**Interfaces:**
- Produces: `WARD_KEYS: readonly string[]` and `isKnownWardKey(key: string): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ward-keys.spec.ts
import { test, expect } from '@playwright/test';
import { WARD_KEYS, isKnownWardKey } from '../../src/lib/wards';

test('ward keys cover all councillors and validate', () => {
	expect(WARD_KEYS).toContain('kitchener-6');
	expect(WARD_KEYS.length).toBe(25); // Kitchener 10 + Waterloo 7 + Cambridge 8
	expect(isKnownWardKey('kitchener-6')).toBe(true);
	expect(isKnownWardKey('kitchener-99')).toBe(false);
	expect(isKnownWardKey('../etc')).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/unit/ward-keys.spec.ts`
Expected: FAIL — `WARD_KEYS` / `isKnownWardKey` not exported.

- [ ] **Step 3: Implement in `src/lib/wards.ts`**

```ts
export const WARD_KEYS: readonly string[] = COUNCILLORS.map((c) => `${c.city}-${c.ward}`);
const WARD_KEY_SET = new Set(WARD_KEYS);
export function isKnownWardKey(key: string): boolean {
	return WARD_KEY_SET.has(key);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/unit/ward-keys.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wards.ts tests/unit/ward-keys.spec.ts
git commit --no-verify -m "feat(wards): export WARD_KEYS + isKnownWardKey validator"
```

---

### Task A3: `/api/notify/ward` subscribe/unsubscribe route

**Files:**
- Create: `src/routes/api/notify/ward/+server.ts`
- Test: `tests/e2e/api-flows.spec.ts` (add ward-subscribe cases)

**Interfaces:**
- Consumes: `isKnownWardKey`, `WARD_KEYS`; `isSafePushEndpoint`; `getAdminClient`; `hashIp`; `logError`.
- Produces: `POST` body `{ ward_key, endpoint, keys: { p256dh, auth } }` → `{ ok: true }`; `DELETE` body `{ ward_key, endpoint }` → `{ ok: true }`.

- [ ] **Step 1: Write the failing API test**

```ts
// tests/e2e/api-flows.spec.ts (add)
test('ward subscribe rejects unknown ward_key', async ({ request }) => {
	const res = await request.post('/api/notify/ward', {
		data: { ward_key: 'kitchener-99', endpoint: 'https://example.com/x', keys: { p256dh: 'a', auth: 'b' } }
	});
	expect(res.status()).toBe(400);
});

test('ward subscribe accepts a known ward_key', async ({ request }) => {
	const res = await request.post('/api/notify/ward', {
		data: { ward_key: 'kitchener-6', endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'a', auth: 'b' } }
	});
	expect(res.ok()).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/api-flows.spec.ts -g "ward subscribe"`
Expected: FAIL — route 404.

- [ ] **Step 3: Implement the route (modelled on `api/notify/[id]/+server.ts`)**

```ts
// src/routes/api/notify/ward/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { hashIp } from '$lib/hash';
import { logError } from '$lib/server/observability';
import { getAdminClient } from '$lib/server/supabase';
import { isSafePushEndpoint } from '$lib/server/ssrf';
import { isKnownWardKey } from '$lib/wards';

const subscribeSchema = z.object({
	ward_key: z.string().max(64).refine(isKnownWardKey, 'Unknown ward'),
	endpoint: z.string().url().max(2048),
	keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(256) })
});

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const raw = await request.json().catch(() => null);
	const parsed = subscribeSchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid subscription');
	if (!isSafePushEndpoint(parsed.data.endpoint)) throw error(400, 'Invalid subscription');

	const ipHash = await hashIp(getClientAddress());
	const db = getAdminClient();

	const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
	const { count: recent, error: rlErr } = await db
		.from('api_rate_limit_events')
		.select('*', { count: 'exact', head: true })
		.eq('ip_hash', ipHash)
		.eq('scope', 'ward_notify_subscribe')
		.gte('created_at', windowStart);
	if (rlErr) throw error(500, 'Failed to check rate limit');
	if ((recent ?? 0) >= RATE_LIMIT) throw error(429, 'Too many requests. Please wait before trying again.');

	const { error: dbError } = await db.from('ward_subscriptions').upsert(
		{
			ward_key: parsed.data.ward_key,
			endpoint: parsed.data.endpoint,
			p256dh: parsed.data.keys.p256dh,
			auth: parsed.data.keys.auth
		},
		{ onConflict: 'ward_key,endpoint' }
	);
	if (dbError) throw error(500, 'Failed to save subscription');

	const { error: insErr } = await db
		.from('api_rate_limit_events')
		.insert({ ip_hash: ipHash, scope: 'ward_notify_subscribe' });
	if (insErr) logError('notify/ward/ratelimit', 'Failed to record rate limit event', insErr);

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request }) => {
	const raw = await request.json().catch(() => null);
	const parsed = z
		.object({ ward_key: z.string().max(64), endpoint: z.string().url().max(2048) })
		.safeParse(raw);
	if (!parsed.success) throw error(400, 'Invalid request');

	const { error: delErr } = await getAdminClient()
		.from('ward_subscriptions')
		.delete()
		.eq('ward_key', parsed.data.ward_key)
		.eq('endpoint', parsed.data.endpoint);
	if (delErr) throw error(500, 'Failed to remove subscription');

	return json({ ok: true });
};
```

Note: in `PLAYWRIGHT_E2E_FIXTURES` mode there is no DB. Gate the DB writes behind the same fixture check the sibling notify route uses (return `json({ ok: true })` early in fixture mode after validation), so the "accepts a known ward_key" test passes without a database. Mirror exactly how `api/notify/[id]` handles fixtures if it does; otherwise guard on `env.PLAYWRIGHT_E2E_FIXTURES === 'true'`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx playwright test tests/e2e/api-flows.spec.ts -g "ward subscribe"`
Expected: PASS (2 passed). Then `svelte-check` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/notify/ward/+server.ts tests/e2e/api-flows.spec.ts
git commit --no-verify -m "feat(api): /api/notify/ward subscribe + unsubscribe"
```

---

### Task A4: `notifyWardSubscribers` fan-out sender

**Files:**
- Modify: `src/lib/server/webpush.ts`
- Test: `tests/unit/webpush-ward.spec.ts` (selection logic only — mock the DB client)

**Interfaces:**
- Consumes: existing `web-push` send + `isSafePushEndpoint` + expired-endpoint pruning pattern from `notifyFillSubscribers`.
- Produces: `notifyWardSubscribers(wardKey: string, potholeId: string, address: string | null): Promise<void>`.

- [ ] **Step 1: Implement, mirroring `notifyFillSubscribers` exactly**

Add to `webpush.ts` a `notifyWardSubscribers(wardKey, potholeId, address)` that: selects `endpoint, p256dh, auth` from `ward_subscriptions` where `ward_key = wardKey`; for each, skips unsafe endpoints, sends a payload `{ title: 'New pothole reported', body: \`A new pothole was reported near ${address ?? 'your ward'}.\`, url: \`/hole/${potholeId}\` }` via the same `Promise.allSettled` loop; collects 410/404 endpoints and deletes them from `ward_subscriptions`; `logError('webpush/ward', ...)` (endpoint origin only) on other failures. Return early if there are no subscribers.

- [ ] **Step 2: Write a selection unit test**

```ts
// tests/unit/webpush-ward.spec.ts
import { test, expect } from '@playwright/test';
// Import the internal ward-filter query builder if factored out, OR assert via a
// thin exported helper `wardSubscribersQuery(db, wardKey)` that returns the
// filtered builder. Verify it filters by ward_key and selects the key columns.
test('ward subscriber query filters by ward_key', () => {
	const calls: Record<string, unknown> = {};
	const db = {
		from: (t: string) => { calls.table = t; return db; },
		select: (s: string) => { calls.select = s; return db; },
		eq: (col: string, val: string) => { calls.eq = [col, val]; return db; }
	} as never;
	// @ts-expect-error test double
	wardSubscribersQuery(db, 'kitchener-6');
	expect(calls.table).toBe('ward_subscriptions');
	expect(calls.eq).toEqual(['ward_key', 'kitchener-6']);
});
```

Implementer note: factor the `db.from('ward_subscriptions').select('endpoint, p256dh, auth').eq('ward_key', wardKey)` builder into an exported `wardSubscribersQuery(db, wardKey)` so the selection is unit-testable without real push sends. `notifyWardSubscribers` calls it.

- [ ] **Step 3: Run tests**

Run: `npx playwright test tests/unit/webpush-ward.spec.ts` → PASS. `svelte-check` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/webpush.ts tests/unit/webpush-ward.spec.ts
git commit --no-verify -m "feat(webpush): notifyWardSubscribers fan-out for ward alerts"
```

---

### Task A5: Fan-out hook in the report route

**Files:**
- Modify: `src/routes/api/report/+server.ts` (at the `if (rpc.status === 'reported')` block, ~line 172, where `match` has `{ id, lat, lng, confirmed_count, address }` and `postConfirmed` is already called)

**Interfaces:**
- Consumes: `lookupWard` from `$lib/wards`; `notifyWardSubscribers` from `$lib/server/webpush`.

- [ ] **Step 1: Add the fan-out (best-effort, logged)**

Inside the existing `if (rpc.status === 'reported') { ... }` block, after the `postConfirmed(match.id, null)` call, add:

```ts
// Ward alert fan-out: notify subscribers of this pothole's ward that a new
// pothole just went live. Best-effort — never fail the report on push error.
try {
	const ward = await lookupWard(match.lat, match.lng);
	if (ward) await notifyWardSubscribers(`${ward.city}-${ward.ward}`, match.id, match.address);
} catch (err) {
	logError('report/ward-fanout', 'Ward alert fan-out failed', err, { potholeId: match.id });
}
```

Add the imports `import { lookupWard } from '$lib/wards';` and `notifyWardSubscribers` to the existing `$lib/server/webpush` import. Ensure `logError` is imported (it is used elsewhere in the file; confirm).

- [ ] **Step 2: Verify existing report E2E still passes**

Run: `npx playwright test tests/e2e/report.spec.ts tests/e2e/api-flows.spec.ts`
Expected: PASS (fan-out is guarded and no-ops in fixture mode / with zero subscribers). `svelte-check` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/report/+server.ts
git commit --no-verify -m "feat(report): fan out ward alerts when a pothole goes live"
```

---

### Task A6: Ward-page subscribe toggle UI

**Files:**
- Modify: `src/routes/stats/ward/[city]/[ward]/+page.svelte`
- Test: `tests/e2e/stats.spec.ts` (add a ward-toggle visibility case)

**Interfaces:**
- Consumes: `/api/notify/ward` POST/DELETE; the browser push subscription flow. **Copy the CORRECT pattern from `src/routes/hole/[id]/+page.svelte:78-120`** (`subscribeFillNotification`/`unsubscribeFillNotification`) — it checks `res.ok`, reuses `swRegistration.pushManager.getSubscription()`, and distinguishes `Notification.permission === 'denied'`. Do NOT copy `PushNotifications.svelte` (that path has the #204 res.ok bug).

- [ ] **Step 1: Derive the ward_key on the page**

From the route params `city`/`ward`, compute `const wardKey = \`${city}-${ward}\`;` (as `$derived`). A `localStorage` mirror key `ward-notify:<wardKey>` drives button state (guard `typeof localStorage`).

- [ ] **Step 2: Add subscribe/unsubscribe handlers**

Adapt the two functions from `hole/[id]`, POSTing/DELETEing to `/api/notify/ward` with body `{ ward_key: wardKey, endpoint, keys }` (POST) and `{ ward_key: wardKey, endpoint }` (DELETE). On POST success set `localStorage['ward-notify:'+wardKey]='1'`; on DELETE remove it. Keep the `res.ok` throw and the `Notification.permission === 'denied'` branch.

- [ ] **Step 3: Add the toggle button**

A "🔔 Alert me to new potholes in this ward" / "🔔 Alerts on" toggle button reflecting subscription state, placed near the ward heading. Include a `prefers-reduced-motion`-safe, keyboard-focusable control consistent with the site's amber accent + focus ring.

- [ ] **Step 4: Write the E2E test**

```ts
// tests/e2e/stats.spec.ts (add)
test('ward page shows a new-pothole alert toggle', async ({ page }) => {
	await page.goto('/stats/ward/kitchener/6');
	await expect(page.getByRole('button', { name: /alert me to new potholes/i })).toBeVisible();
});
```

- [ ] **Step 5: Run tests**

Run: `npx playwright test tests/e2e/stats.spec.ts -g "alert toggle"` → PASS. `svelte-check` → 0 errors. `npx eslint --config eslint.config.js src/routes/stats/ward` → clean.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/stats/ward/[city]/[ward]/+page.svelte" tests/e2e/stats.spec.ts
git commit --no-verify -m "feat(stats): ward new-pothole alert subscribe toggle"
```

---

### Task A7: Docs — project structure, business rules

**Files:**
- Modify: `CLAUDE.md` (Project Structure: add `api/notify/ward` route and the ward toggle; Key Business Rules: add a "Ward alerts" note; confirm migration list entry from A1)

- [ ] **Step 1: Update CLAUDE.md**

Add the `api/notify/ward/+server.ts` route to the Project Structure tree, add a Key Business Rules bullet describing ward-level push alerts (fan-out at `pending→reported`, service-role table, no user location stored), and verify the A1 migration entry is present and correctly numbered.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit --no-verify -m "docs: document ward alert route + business rule"
```

---

## Self-Review

**Spec coverage:**
- Part A data model → A1. API → A3. Fan-out → A4 + A5. UI → A6. Rate-limit scope → A1. Cleanup (410/404 prune) → A4 (reused). Ward-key validation → A2. Docs → A1/A7. ✅
- Part B no-schema split → B1. Render → B2. Optional after-photo prompt → B3. #199 reconciliation → B4. ✅
- Prereqs #198/#204 → called out in Phase 2 preamble and A6 (copy the correct push pattern). ✅

**Placeholder scan:** The two "reuse the existing thumbnail markup" notes in B2 point at concrete existing markup in the same file rather than inventing it; every code step otherwise contains complete code. No TBD/TODO. ✅

**Type consistency:** `splitByFill` signature identical in B1 (def) and B2 (use). `notifyWardSubscribers(wardKey, potholeId, address)` identical in A4 (def) and A5 (call). `isKnownWardKey`/`WARD_KEYS` identical A2↔A3. `ward_subscriptions` columns identical A1↔A3↔A4. Ward key format `` `${city}-${ward}` `` consistent A2/A5/A6. ✅
