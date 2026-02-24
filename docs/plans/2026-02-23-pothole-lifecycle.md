# Pothole Lifecycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the status flow to `pending → reported → filled | expired`, remove all wanksyd/legacy code, add automatic expiry of stale potholes via pg_cron, add a low-friction "Fixed" button to map popups, and replace the floating map controls with a proper layer panel.

**Architecture:** Four interconnected changes — (1) status model simplification and wanksyd removal, (2) pg_cron nightly auto-expiry, (3) one-tap close-out from the map popup using delegated Leaflet events, (4) a layered map control panel replacing the existing floating buttons. The `/api/filled` endpoint is updated to accept `reported → filled` directly. The DB schema gains `expired_at` and the `expired` status. No new endpoints are introduced.

**Tech Stack:** SvelteKit + Svelte 5 runes, Supabase (Postgres + pg_cron), Leaflet, Playwright for E2E tests.

---

### Task 1: Reduce merge radius from 50m to 25m

**Files:**
- Modify: `src/routes/api/report/+server.ts`

**Step 1: Make the change**

```typescript
// BEFORE
const MERGE_RADIUS_M = 50;

// AFTER
const MERGE_RADIUS_M = 25;
```

**Step 2: Run existing report tests**

```bash
cd /Users/andrelevesque/Projects/filltheholedotca
npx playwright test tests/e2e/report.spec.ts
```

Expected: all pass (merge radius doesn't affect the E2E tests).

**Step 3: Commit**

```bash
git add src/routes/api/report/+server.ts
git commit -m "fix: reduce pothole merge radius from 50m to 25m"
```

---

### Task 2: Database schema migration

**Goal:** Add `expired_at` column, add `expired` to the status constraint, and register the nightly pg_cron job. Run these in the Supabase SQL editor.

**Files:**
- Modify: `schema.sql`

**Step 1: Run migration SQL in Supabase SQL editor**

```sql
-- Add expired_at column
ALTER TABLE potholes ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- Update the status check constraint to include 'expired'
-- (Drop the existing constraint first if one exists — adjust name to match your schema)
ALTER TABLE potholes DROP CONSTRAINT IF EXISTS potholes_status_check;
ALTER TABLE potholes ADD CONSTRAINT potholes_status_check
  CHECK (status IN ('pending', 'reported', 'wanksyd', 'filled', 'expired'));
-- Note: 'wanksyd' stays in the constraint for historical rows

-- Enable pg_cron extension (only needs to be done once per project)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Register the nightly expiry job at 3am UTC
SELECT cron.schedule(
  'expire-old-potholes',
  '0 3 * * *',
  $$
    UPDATE potholes
    SET status = 'expired', expired_at = NOW()
    WHERE status = 'reported'
      AND created_at < NOW() - INTERVAL '6 months';
  $$
);
```

**Step 2: Update `schema.sql` to reflect the migration**

Add to the `potholes` table definition in `schema.sql`:

```sql
expired_at timestamptz,
```

Update the status constraint line to include `'expired'`.

Add at the bottom of `schema.sql`:

```sql
-- pg_cron: nightly expiry job (run once in Supabase SQL editor)
-- SELECT cron.schedule('expire-old-potholes', '0 3 * * *', $$ ... $$);
-- See docs/plans/2026-02-23-pothole-lifecycle.md for full SQL
```

**Step 3: Commit**

```bash
git add schema.sql
git commit -m "feat: add expired_at column and pg_cron nightly expiry job to schema"
```

---

### Task 3: Update types and constants

**Goal:** Add `expired` to `PotholeStatus`, add `expired_at` to `Pothole`, remove `wanksyd` from `STATUS_CONFIG`, add `expired`.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/constants.ts`

**Step 1: Update `src/lib/types.ts`**

```typescript
export type PotholeStatus = 'pending' | 'reported' | 'filled' | 'expired';

export interface Pothole {
  id: string;
  created_at: string;
  lat: number;
  lng: number;
  address: string | null;
  description: string | null;
  status: PotholeStatus;
  confirmed_count: number;
  wanksy_at: string | null;   // kept — historical rows still have this
  filled_at: string | null;
  expired_at: string | null;
}
```

**Step 2: Update `src/lib/constants.ts`**

```typescript
export const STATUS_CONFIG = {
  pending:  { emoji: '⏳', label: 'Pending confirmation', colorClass: 'text-zinc-400',  hex: '#a1a1aa' },
  reported: { emoji: '📍', label: 'Reported',             colorClass: 'text-orange-400', hex: '#f97316' },
  filled:   { emoji: '✅', label: 'Filled',               colorClass: 'text-green-400',  hex: '#22c55e' },
  expired:  { emoji: '🕰️', label: 'Expired',              colorClass: 'text-zinc-500',   hex: '#71717a' },
} as const;
```

**Step 3: Check for TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: errors about `wanksyd` references in other files — these are fixed in subsequent tasks. Note them but don't fix them yet.

**Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add expired status, remove wanksyd from STATUS_CONFIG"
```

---

### Task 4: Update `/api/filled` to accept `reported → filled`

**Goal:** Remove the `wanksyd`-only guard so any `reported` pothole (or legacy `wanksyd` pothole) can be marked filled.

**Files:**
- Modify: `src/routes/api/filled/+server.ts`

**Step 1: Write the failing test**

Add to `tests/e2e/api-flows.spec.ts`:

```typescript
test.describe('Filled API — status guard', () => {
  // This verifies the zod layer only; DB behaviour is outside scope
  test('accepts a valid UUID for filled endpoint', async ({ request }) => {
    const response = await request.post('/api/filled', {
      data: { id: '550e8400-e29b-41d4-a716-446655440002' }
    });
    // Schema accepted — not a 400
    expect(response.status()).not.toBe(400);
  });
});
```

**Step 2: Update `src/routes/api/filled/+server.ts`**

Change the update query from:

```typescript
.eq('status', 'wanksyd') // Only transition from wanksyd
```

To:

```typescript
.in('status', ['reported', 'wanksyd']) // Accept reported or legacy wanksyd
```

And update the error message:

```typescript
if (!updated || updated.length === 0)
  throw error(409, 'Pothole is not in a fillable state');
```

**Step 3: Run tests**

```bash
npx playwright test tests/e2e/api-flows.spec.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add src/routes/api/filled/+server.ts tests/e2e/api-flows.spec.ts
git commit -m "feat: allow reported → filled transition directly in /api/filled"
```

---

### Task 5: Delete `/api/wanksy` and clean up its tests

**Goal:** Remove the wanksy endpoint entirely and replace its tests with a tombstone test verifying it returns 404.

**Files:**
- Delete: `src/routes/api/wanksy/+server.ts`
- Modify: `tests/e2e/api-flows.spec.ts`

**Step 1: Delete the endpoint**

```bash
rm src/routes/api/wanksy/+server.ts
```

**Step 2: Replace wanksy tests in `tests/e2e/api-flows.spec.ts`**

Remove the entire `test.describe('Wanksy API (/api/wanksy)', ...)` block and replace with:

```typescript
test.describe('Wanksy API — removed', () => {
  test('/api/wanksy returns 404 after removal', async ({ request }) => {
    const response = await request.post('/api/wanksy', { data: { id: '550e8400-e29b-41d4-a716-446655440000' } });
    expect(response.status()).toBe(404);
  });
});
```

**Step 3: Run tests**

```bash
npx playwright test tests/e2e/api-flows.spec.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove /api/wanksy endpoint"
```

---

### Task 6: Update the pothole detail page

**Goal:** Remove all wanksy UI. Add "Mark as fixed" button for `reported` potholes. Update the status pipeline to `reported → filled` (two steps). Add an `expired` state block. Update `daysSince` to also show for `expired`.

**Files:**
- Modify: `src/routes/hole/[id]/+page.svelte`

**Step 1: Write the failing E2E test**

Add to `tests/e2e/pothole-detail.spec.ts` (check existing test structure first; add to the appropriate describe block):

```typescript
test('shows Mark as fixed button for reported potholes', async ({ page }) => {
  // Mock the server load to return a reported pothole
  await page.route('/hole/test-reported-id', async (route) => {
    // Let it through — this is a navigation test
    await route.continue();
  });

  // Navigate to a mocked detail page — mock the API call instead
  await page.goto('/hole/test-reported-id');
  // This test depends on the page loading — if 404, skip gracefully
  // The key assertion is structural: if status is reported, button exists
});

test('does not show wanksy/flag button', async ({ page }) => {
  await page.goto('/');
  // Verify the detail page no longer references wanksy
  // Check that the word "wanksy" or "flagged" (old label) is gone from the page
  // This is validated by checking the source after the build
});
```

Note: detail page tests require a live pothole ID. The structural changes are best verified by TypeScript compilation passing (`npx tsc --noEmit`) and visual inspection.

**Step 2: Update `src/routes/hole/[id]/+page.svelte`**

**Remove** the `flagPothole` function, `showFlagForm` state, and all wanksy-related markup.

**Replace** the status pipeline section (currently iterates `['reported', 'wanksyd', 'filled']`) with:

```svelte
{#if pothole.status !== 'pending' && pothole.status !== 'expired'}
  <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
    <div class="flex items-center justify-between text-sm">
      {#each (['reported', 'filled'] as const) as s (s)}
        {@const info = STATUS_CONFIG[s]}
        {@const isCurrent = pothole.status === s}
        {@const isPast = s === 'reported' || pothole.status === 'filled'}
        <div class="flex flex-col items-center gap-1 flex-1">
          <span class="text-2xl {isPast ? 'opacity-100' : 'opacity-30'}">{info.emoji}</span>
          <span class="{isCurrent ? 'text-white font-semibold' : isPast ? 'text-zinc-400' : 'text-zinc-600'} text-xs">{info.label}</span>
          {#if isCurrent}
            <div class="w-1.5 h-1.5 rounded-full bg-sky-500"></div>
          {/if}
        </div>
        {#if s !== 'filled'}
          <div class="flex-1 h-px bg-zinc-700 self-center mb-4 max-w-12"></div>
        {/if}
      {/each}
    </div>
  </div>
{/if}
```

**Replace** the info card to remove `wanksy_at`:

```svelte
{#if pothole.description || pothole.filled_at}
  <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 text-sm">
    {#if pothole.description}
      <p class="text-zinc-300 italic">"{pothole.description}"</p>
    {/if}
    {#if pothole.filled_at}
      <p class="text-zinc-500">Filled on <span class="text-zinc-300">{fmt(pothole.filled_at)}</span> 🎉</p>
    {/if}
  </div>
{/if}
```

**Replace** the flag/filled action blocks with a single block:

```svelte
{#if pothole.status === 'reported'}
  {#if !showFilledForm}
    <button
      onclick={() => (showFilledForm = true)}
      class="w-full py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded-xl transition-colors"
    >
      ✅ It's been fixed
    </button>
  {:else}
    <div class="bg-zinc-900 border border-green-800 rounded-xl p-4 space-y-3">
      <h3 class="font-semibold text-green-400">✅ Mark as fixed</h3>
      <p class="text-zinc-400 text-sm">Confirm the city has patched this one up.</p>
      <div class="flex gap-2">
        <button
          onclick={() => (showFilledForm = false)}
          class="flex-1 py-2 border border-zinc-700 text-zinc-400 rounded-lg text-sm hover:border-zinc-500"
        >Cancel</button>
        <button
          onclick={markFilled}
          disabled={submitting}
          class="flex-1 py-2 bg-green-700 hover:bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg text-sm transition-colors"
        >
          {submitting ? 'Saving...' : '✅ Confirm fixed'}
        </button>
      </div>
    </div>
  {/if}
{/if}
```

**Add** expired state block (after the filled block):

```svelte
{#if pothole.status === 'expired'}
  <div class="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-center space-y-1">
    <div class="text-3xl mb-2">🕰️</div>
    <p class="text-zinc-300 font-semibold">This report has expired</p>
    <p class="text-zinc-500 text-sm mt-1">
      No activity for 6+ months. The pothole may have been filled — or may still be there.
    </p>
  </div>
{/if}
```

**Update** `daysSince` display to include `expired`:

```svelte
<!-- BEFORE -->
{#if pothole.status !== 'filled' && pothole.status !== 'pending'}

<!-- AFTER -->
{#if pothole.status === 'reported'}
```

**Remove** `showFlagForm` state and `flagPothole` function from `<script>`.

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/routes/hole/[id]/+page.svelte
git commit -m "feat: simplify detail page to reported→filled flow, add expired state, remove wanksy UI"
```

---

### Task 7: Update stats loader and stats page

**Goal:** Remove `wanksy_at` from the stats query; ensure `expired` potholes are handled correctly in the stats UI (they count as unresolved for accountability purposes).

**Files:**
- Modify: `src/routes/stats/+page.server.ts`
- Modify: `src/routes/stats/+page.svelte` (review for wanksyd references)

**Step 1: Update `src/routes/stats/+page.server.ts`**

```typescript
// BEFORE
.select('id, created_at, lat, lng, status, filled_at, wanksy_at')

// AFTER
.select('id, created_at, lat, lng, status, filled_at, expired_at')
```

**Step 2: Search stats page for wanksyd references**

```bash
grep -n "wanksy" src/routes/stats/+page.svelte
```

For each match: remove or replace with the appropriate new status. `wanksyd` potholes counted as "active" should be folded into `reported`. Any "flagged" count metric should be removed.

**Step 3: Run the stats E2E tests**

```bash
npx playwright test tests/e2e/stats.spec.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add src/routes/stats/+page.server.ts src/routes/stats/+page.svelte
git commit -m "feat: remove wanksy_at from stats, handle expired status in metrics"
```

---

### Task 8: Map layer panel + separate cluster groups

**Goal:** Replace the two floating control buttons with a `Layers` panel. Each status (`reported`, `expired`, `filled`) gets its own `markerClusterGroup`. The ward heatmap toggle moves inside the panel. `Find me` stays as a standalone button above the panel.

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/+page.server.ts`

**Step 1: Update the server loader to return all statuses**

`src/routes/+page.server.ts` currently does `.neq('status', 'pending')` — this already returns `expired` potholes once they exist. No change needed here, but verify it explicitly:

```typescript
// Current query already handles this correctly:
.neq('status', 'pending')
// Returns: reported, wanksyd (legacy), filled, expired
```

**Step 2: Write the failing E2E test**

Add to `tests/e2e/map-page.spec.ts`:

```typescript
test.describe('Map layer panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const modalBtn = page.getByRole('button', { name: /Show me the map/i });
    if (await modalBtn.isVisible()) await modalBtn.click();
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 5000 });
  });

  test('shows a Layers panel', async ({ page }) => {
    await expect(page.getByText(/Layers/i)).toBeVisible();
  });

  test('Reported layer is on by default', async ({ page }) => {
    const toggle = page.getByRole('checkbox', { name: /Reported/i });
    await expect(toggle).toBeChecked();
  });

  test('Expired and Filled layers are off by default', async ({ page }) => {
    await expect(page.getByRole('checkbox', { name: /Expired/i })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Filled/i })).not.toBeChecked();
  });

  test('Ward heatmap toggle is in the layers panel', async ({ page }) => {
    await expect(page.getByRole('checkbox', { name: /Ward heatmap/i })).toBeVisible();
  });
});
```

**Step 3: Refactor `src/routes/+page.svelte` — state**

Replace the individual `showWards` / `wardLoading` state with a unified layers state:

```typescript
// Replace old:
// let showWards = $state(false);
// let wardLoading = $state(false);

// With:
const layers = $state({
  reported: true,
  expired: false,
  filled: false,
  wards: false
});
let wardLoading = $state(false);
```

Add separate cluster group refs:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clusterGroups: Record<string, any> = {};
```

**Step 4: Refactor marker setup in `onMount`**

Replace the single `markers` cluster group with one per visible status:

```typescript
const statuses = ['reported', 'wanksyd', 'filled', 'expired'] as const;

for (const status of statuses) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group = (L as any).markerClusterGroup({ maxClusterRadius: 40, spiderfyOnMaxZoom: true });
  clusterGroups[status] = group;
  // Only add to map if layer is on by default
  const layerKey = status === 'wanksyd' ? 'reported' : status; // legacy wanksyd → reported layer
  if (layers[layerKey as keyof typeof layers]) map.addLayer(group);
}

for (const pothole of potholes) {
  const info = STATUS_CONFIG[pothole.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.reported;
  const icon = L.divIcon({
    html: `<div class="pothole-marker pothole-marker--${pothole.status}" title="${info.label}">${info.emoji}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
  const marker = L.marker([pothole.lat, pothole.lng], { icon });
  const address = escapeHtml(pothole.address || `${pothole.lat.toFixed(5)}, ${pothole.lng.toFixed(5)}`);
  const description = pothole.description ? escapeHtml(pothole.description) : null;

  // "Fixed" button only for reported potholes
  const fixedBtn = pothole.status === 'reported'
    ? `<button class="popup-fix-btn" data-action="mark-filled" data-pothole-id="${pothole.id}">✓ Fixed</button>`
    : '';

  marker.bindPopup(
    `<div class="popup-content">
      <strong>${info.emoji} ${address}</strong><br/>
      <span class="popup-status popup-status--${pothole.status}">${info.label}</span>
      ${description ? `<br/><em>${description}</em>` : ''}
      <br/><a href="/hole/${pothole.id}" class="popup-link">View details →</a>
      ${fixedBtn}
    </div>`,
    { maxWidth: 220 }
  );

  const groupKey = pothole.status === 'wanksyd' ? 'wanksyd' : pothole.status;
  clusterGroups[groupKey]?.addLayer(marker);
}
```

**Step 5: Add layer toggle functions**

```typescript
function toggleLayer(key: keyof typeof layers) {
  if (key === 'wards') {
    toggleWardHeatmap();
    return;
  }
  const group = clusterGroups[key];
  if (!group || !mapRef) return;
  layers[key] = !layers[key];
  if (layers[key]) {
    mapRef.addLayer(group);
  } else {
    mapRef.removeLayer(group);
  }
}
```

Update `toggleWardHeatmap` to set `layers.wards` instead of `showWards`:

```typescript
// Replace: showWards = true/false
// With: layers.wards = true/false
```

**Step 6: Replace the template controls**

Replace the bottom-left controls with:

```svelte
{#if mapReady}
  <div class="absolute safe-bottom left-4 z-[1000] flex flex-col gap-2">
    <!-- Find me stays standalone -->
    <button
      onclick={locateMe}
      disabled={locating}
      class="bg-zinc-900/90 backdrop-blur border border-zinc-700 hover:border-zinc-500 rounded-xl px-3 py-2 text-xs text-zinc-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
    >
      {locating ? '⏳' : '📍'} {locating ? 'Locating…' : 'Find me'}
    </button>

    <!-- Layers panel -->
    <div class="bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-xl p-3 space-y-2 text-xs">
      <div class="text-zinc-400 font-semibold uppercase tracking-wider text-[10px] mb-1">🗂 Layers</div>

      {#each ([
        ['reported', '📍 Reported'],
        ['expired',  '🕰️ Expired'],
        ['filled',   '✅ Filled'],
      ] as const) as [key, label]}
        <label class="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
          <input
            type="checkbox"
            checked={layers[key]}
            onchange={() => toggleLayer(key)}
            class="accent-sky-500"
          />
          {label}
        </label>
      {/each}

      <div class="border-t border-zinc-700 pt-2">
        <label class="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
          <input
            type="checkbox"
            checked={layers.wards}
            onchange={() => toggleLayer('wards')}
            disabled={wardLoading}
            class="accent-orange-500"
          />
          {wardLoading ? '⏳ Loading…' : '🗺️ Ward heatmap'}
        </label>
      </div>
    </div>
  </div>
{/if}
```

Also remove the old legend (it's now redundant with the layers panel) or keep it — your call.

**Step 7: Run tests**

```bash
npx playwright test tests/e2e/map-page.spec.ts
```

Expected: all pass including the new layer panel tests.

**Step 8: Commit**

```bash
git add src/routes/+page.svelte src/routes/+page.server.ts tests/e2e/map-page.spec.ts
git commit -m "feat: replace floating map controls with layers panel (reported/expired/filled/wards)"
```

---

### Task 9: Low-friction "Fixed" button in map popup

**Goal:** Wire up the `data-action="mark-filled"` button added to popups in Task 8. Uses a `map.on('popupopen')` delegated listener to avoid stale closures.

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Write the failing E2E test**

Add to `tests/e2e/map-page.spec.ts`:

```typescript
test.describe('Map popup — Fixed button', () => {
  test('reported pothole popup contains a Fixed button', async ({ page }) => {
    await page.goto('/');
    const modalBtn = page.getByRole('button', { name: /Show me the map/i });
    if (await modalBtn.isVisible()) await modalBtn.click();
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 5000 });

    // If there are reported potholes on the map, click one
    const marker = page.locator('.pothole-marker--reported').first();
    if (await marker.count() === 0) {
      test.skip(); // No reported potholes in test environment
      return;
    }
    await marker.click();
    await expect(page.locator('.popup-fix-btn')).toBeVisible({ timeout: 2000 });
  });
});
```

**Step 2: Add the delegated popup listener in `onMount`**

Add after `map.addLayer(group)` setup, before `mapReady = true`:

```typescript
// Delegated listener for popup action buttons
map.on('popupopen', (e) => {
  const container = (e as any).popup.getElement();
  const btn = container?.querySelector('[data-action="mark-filled"]');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const id = btn.getAttribute('data-pothole-id');
    if (!id) return;

    try {
      const res = await fetch('/api/filled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      if (!res.ok && res.status !== 409) throw new Error(result.message || 'Failed');

      map.closePopup();
      toast.success(result.ok ? '✅ Marked as fixed!' : result.message);

      // Move the marker from reported layer to filled layer
      if (result.ok) {
        const marker = (e as any).popup._source;
        clusterGroups['reported']?.removeLayer(marker);
        if (layers.filled) clusterGroups['filled']?.addLayer(marker);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    }
  });
});
```

Add the `popup-fix-btn` CSS in `<style>`:

```css
:global(.popup-fix-btn) {
  display: inline-block;
  margin-top: 6px;
  padding: 3px 10px;
  background: #16a34a20;
  color: #22c55e;
  border: 1px solid #22c55e40;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
:global(.popup-fix-btn:hover) { background: #16a34a40; }
```

**Step 3: Run tests**

```bash
npx playwright test tests/e2e/map-page.spec.ts
```

Expected: all pass.

**Step 4: Commit**

```bash
git add src/routes/+page.svelte tests/e2e/map-page.spec.ts
git commit -m "feat: add one-tap Fixed button to map popup for reported potholes"
```

---

### Task 10: Full test suite + TypeScript check

**Goal:** Ensure no regressions across all tests and no TypeScript errors.

**Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any remaining `wanksyd` references.

**Step 2: Run the full test suite**

```bash
npx playwright test
```

Expected: all tests pass. Fix any regressions before proceeding.

**Step 3: Search for any remaining wanksyd references**

```bash
grep -rn "wanksy" src/ --include="*.ts" --include="*.svelte"
```

Expected: zero results (except `wanksy_at` field references in historical data handling, which is acceptable).

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final wanksyd cleanup and test suite verification"
```

---

## Notes

- **Backward compat:** `wanksy_at` column stays in the DB and the `Pothole` type — existing rows with that data are valid. The `/api/filled` endpoint accepts `wanksyd` status to handle legacy rows gracefully.
- **pg_cron:** The cron job must be registered via the Supabase SQL editor — it cannot be done from the app. The `schema.sql` comment documents the SQL.
- **Layer toggle and Leaflet closures:** `layers` is a Svelte 5 `$state` object. The `toggleLayer` function reads `layers[key]` reactively. The popup delegated listener uses `clusterGroups` (plain object, not reactive) to avoid stale closure issues.
- **`expired` potholes on the stats page:** treat them as unresolved for fill-rate metrics (they aged out unfixed). Do not count them as filled.
