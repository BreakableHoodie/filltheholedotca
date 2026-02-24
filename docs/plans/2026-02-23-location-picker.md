# Location Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add address/intersection search and map pin-drop as alternatives to GPS on the report form, plus a pin-drop mode on the main map that hands off coordinates to the form via URL params.

**Architecture:** Three tabs on `/report` (GPS / Address / Pick on map) replace the single GPS button. A unified `lat !== null && lng !== null` guard controls form submission. The main map gains a toggleable "Report here" mode that navigates to `/report?lat=…&lng=…`, which the form reads on mount to pre-fill the pin-drop tab. No API changes — the existing `/api/report` endpoint already accepts `lat`, `lng`, `address` from any source.

**Tech Stack:** SvelteKit + Svelte 5 runes, Leaflet (already in project, client-only dynamic import), Nominatim reverse/forward geocoding (already used), Playwright for E2E tests.

---

### Task 1: Update submit guard + URL param pre-fill

**Goal:** Decouple the submit button from GPS so any location source can unlock it. Pre-fill the form when navigated from the main map with `?lat=&lng=`.

**Files:**
- Modify: `src/routes/report/+page.svelte`

**Step 1: Write the failing E2E test**

Add to `tests/e2e/report.spec.ts`:

```typescript
test.describe('Report form — URL pre-fill', () => {
  test('pre-fills location from ?lat=&lng= URL params', async ({ page }) => {
    // Mock Nominatim reverse geocode
    await page.route('*nominatim.openstreetmap.org/reverse*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ address: { road: 'King St N', suburb: 'Waterloo' } })
      });
    });

    await page.goto('/report?lat=43.45&lng=-80.5');

    // Close modal if present
    const modalBtn = page.getByRole('button', { name: /Show me the map/i });
    if (await modalBtn.isVisible()) await modalBtn.click();

    // Submit button should be enabled (lat/lng are set)
    const submit = page.getByRole('button', { name: /Report this hole/i });
    await expect(submit).not.toBeDisabled({ timeout: 3000 });
  });
});
```

**Step 2: Run to confirm it fails**

```bash
cd /Users/andrelevesque/Projects/filltheholedotca
npx playwright test tests/e2e/report.spec.ts --grep "pre-fills location from"
```

Expected: FAIL — submit button is still disabled because GPS hasn't fired.

**Step 3: Implement URL param reading + guard change**

In `src/routes/report/+page.svelte`, make these changes:

1. Add `import { page } from '$app/stores';` at the top of `<script>`.

2. In `onMount`, before calling `getLocation()`, check URL params:

```typescript
onMount(() => {
  const urlLat = Number($page.url.searchParams.get('lat'));
  const urlLng = Number($page.url.searchParams.get('lng'));

  if (urlLat && urlLng) {
    lat = urlLat;
    lng = urlLng;
    reverseGeocode(urlLat, urlLng);
    // Don't auto-fire GPS — location already known
    return;
  }

  getLocation();
});
```

3. Change the submit button's `disabled` condition:

```svelte
<!-- BEFORE -->
disabled={submitting || gpsStatus !== 'got'}

<!-- AFTER -->
disabled={submitting || lat === null || lng === null}
```

4. Change `handleSubmit` guard:

```typescript
// BEFORE
if (gpsStatus !== 'got') return;

// AFTER
if (lat === null || lng === null) return;
```

**Step 4: Run test to verify it passes**

```bash
npx playwright test tests/e2e/report.spec.ts --grep "pre-fills location from"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/report/+page.svelte tests/e2e/report.spec.ts
git commit -m "feat: unlock report form from any lat/lng source, read URL params on mount"
```

---

### Task 2: Tab UI on the report page

**Goal:** Add a `locationMode` state with three tabs. Each tab shows a different location-picking panel. The GPS tab is the default and contains the existing button unchanged.

**Files:**
- Modify: `src/routes/report/+page.svelte`

**Step 1: Write the failing E2E test**

Add to `tests/e2e/report.spec.ts`:

```typescript
test.describe('Report form — location tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report');
    const modalBtn = page.getByRole('button', { name: /Show me the map/i });
    if (await modalBtn.isVisible()) await modalBtn.click();
  });

  test('shows three location tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /GPS/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Address/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Pick on map/i })).toBeVisible();
  });

  test('GPS tab is active by default', async ({ page }) => {
    const gpsTab = page.getByRole('tab', { name: /GPS/i });
    await expect(gpsTab).toHaveAttribute('aria-selected', 'true');
  });

  test('switching to Address tab shows address input', async ({ page }) => {
    await page.getByRole('tab', { name: /Address/i }).click();
    await expect(page.getByPlaceholder(/Enter an address/i)).toBeVisible();
  });
});
```

**Step 2: Run to confirm it fails**

```bash
npx playwright test tests/e2e/report.spec.ts --grep "location tabs"
```

Expected: FAIL — no tabs exist yet.

**Step 3: Add tab state and tab bar to the location card**

In `src/routes/report/+page.svelte`:

Add state at the top of `<script>`:

```typescript
let locationMode = $state<'gps' | 'address' | 'map'>('gps');
```

Replace the location card's inner `<div class="flex items-center justify-between">` header with this structure (keep all existing GPS content, just wrap it):

```svelte
<!-- Tab bar -->
<div role="tablist" class="flex gap-1 bg-zinc-800 rounded-lg p-1">
  {#each ([['gps', '📍 GPS'], ['address', '🔍 Address'], ['map', '🗺️ Pick on map']] as const) as [mode, label]}
    <button
      role="tab"
      aria-selected={locationMode === mode}
      type="button"
      onclick={() => locationMode = mode}
      class="flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-colors
        {locationMode === mode
          ? 'bg-zinc-700 text-white'
          : 'text-zinc-400 hover:text-zinc-200'}"
    >
      {label}
    </button>
  {/each}
</div>

<!-- GPS panel -->
{#if locationMode === 'gps'}
  <!-- existing GPS button and status markup goes here, unchanged -->
{/if}

<!-- Address panel — placeholder for Task 3 -->
{#if locationMode === 'address'}
  <p class="text-xs text-zinc-400">Address search coming soon…</p>
{/if}

<!-- Map panel — placeholder for Task 4 -->
{#if locationMode === 'map'}
  <p class="text-xs text-zinc-400">Map picker coming soon…</p>
{/if}
```

Also update `onMount` to switch to `'map'` tab when URL params are present:

```typescript
if (urlLat && urlLng) {
  lat = urlLat;
  lng = urlLng;
  locationMode = 'map';       // ← add this line
  reverseGeocode(urlLat, urlLng);
  return;
}
```

**Step 4: Run tests**

```bash
npx playwright test tests/e2e/report.spec.ts --grep "location tabs"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/report/+page.svelte tests/e2e/report.spec.ts
git commit -m "feat: add GPS/Address/Map tabs to report location card"
```

---

### Task 3: Address search tab (Nominatim typeahead)

**Goal:** Debounced address search bounded to Waterloo Region. Dropdown of up to 5 results. Selecting a result sets `lat`, `lng`, `address`.

**Files:**
- Modify: `src/routes/report/+page.svelte`

**Step 1: Write the failing E2E test**

Add to `tests/e2e/report.spec.ts`:

```typescript
test.describe('Report form — address search', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Nominatim search (forward geocode)
    await page.route('*nominatim.openstreetmap.org/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            lat: '43.45',
            lon: '-80.50',
            display_name: '123 King St N, Waterloo, ON'
          },
          {
            lat: '43.46',
            lon: '-80.51',
            display_name: '456 King St N, Waterloo, ON'
          }
        ])
      });
    });

    await page.goto('/report');
    const modalBtn = page.getByRole('button', { name: /Show me the map/i });
    if (await modalBtn.isVisible()) await modalBtn.click();

    await page.getByRole('tab', { name: /Address/i }).click();
  });

  test('shows address input on Address tab', async ({ page }) => {
    await expect(page.getByPlaceholder(/Enter an address/i)).toBeVisible();
  });

  test('typing shows suggestions dropdown', async ({ page }) => {
    await page.getByPlaceholder(/Enter an address/i).fill('King St');
    // Wait for debounce (300ms) + render
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 1000 });
    await expect(page.getByRole('option').first()).toContainText('King St N');
  });

  test('selecting a suggestion enables submit button', async ({ page }) => {
    await page.route('/api/report', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 'test-id', message: 'ok' }) });
    });

    await page.getByPlaceholder(/Enter an address/i).fill('King St');
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 1000 });
    await page.getByRole('option').first().click();

    const submit = page.getByRole('button', { name: /Report this hole/i });
    await expect(submit).not.toBeDisabled();
  });
});
```

**Step 2: Run to confirm it fails**

```bash
npx playwright test tests/e2e/report.spec.ts --grep "address search"
```

Expected: FAIL

**Step 3: Implement address search panel**

Add to `<script>` in `src/routes/report/+page.svelte`:

```typescript
// Address search state
let addressQuery = $state('');
let addressSuggestions = $state<Array<{ lat: string; lon: string; display_name: string }>>([]);
let addressSearching = $state(false);
let addressDebounce: ReturnType<typeof setTimeout> | null = null;

// Waterloo Region bounding box for Nominatim: minLon,minLat,maxLon,maxLat
const WR_VIEWBOX = '-80.59,43.32,-80.22,43.53';

async function searchAddress(query: string) {
  if (query.trim().length < 3) {
    addressSuggestions = [];
    return;
  }
  addressSearching = true;
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      viewbox: WR_VIEWBOX,
      bounded: '1'
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'fillthehole.ca' }
    });
    addressSuggestions = await res.json();
  } catch {
    addressSuggestions = [];
  } finally {
    addressSearching = false;
  }
}

function onAddressInput() {
  if (addressDebounce) clearTimeout(addressDebounce);
  addressDebounce = setTimeout(() => searchAddress(addressQuery), 300);
}

function selectSuggestion(s: { lat: string; lon: string; display_name: string }) {
  lat = parseFloat(s.lat);
  lng = parseFloat(s.lon);
  address = s.display_name;
  addressQuery = s.display_name;
  addressSuggestions = [];
}
```

Replace the address panel placeholder with:

```svelte
{#if locationMode === 'address'}
  <div class="relative">
    <input
      type="text"
      placeholder="Enter an address or intersection…"
      bind:value={addressQuery}
      oninput={onAddressInput}
      class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500"
      autocomplete="off"
    />
    {#if addressSearching}
      <p class="text-xs text-zinc-500 mt-1">Searching…</p>
    {/if}
    {#if addressSuggestions.length > 0}
      <ul
        role="listbox"
        class="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden"
      >
        {#each addressSuggestions as s (s.display_name)}
          <li
            role="option"
            aria-selected={address === s.display_name}
            class="px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 cursor-pointer"
            onclick={() => selectSuggestion(s)}
          >
            {s.display_name}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  {#if lat !== null && addressQuery && addressSuggestions.length === 0}
    <p class="text-xs text-zinc-400">📌 {address}</p>
  {/if}
{/if}
```

**Step 4: Run tests**

```bash
npx playwright test tests/e2e/report.spec.ts --grep "address search"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/report/+page.svelte tests/e2e/report.spec.ts
git commit -m "feat: add address/intersection search with Nominatim typeahead to report form"
```

---

### Task 4: Mini map pin-drop tab (report page)

**Goal:** A compact Leaflet map in the "Pick on map" tab. Click to place a draggable pin. Pin placement fires reverse geocode. Map only mounts when the tab is active.

**Files:**
- Modify: `src/routes/report/+page.svelte`

**Step 1: Write the failing E2E test**

Add to `tests/e2e/report.spec.ts`:

```typescript
test.describe('Report form — mini map tab', () => {
  test('shows a map element when Pick on map tab is active', async ({ page }) => {
    await page.goto('/report');
    const modalBtn = page.getByRole('button', { name: /Show me the map/i });
    if (await modalBtn.isVisible()) await modalBtn.click();

    await page.getByRole('tab', { name: /Pick on map/i }).click();

    // Leaflet renders a div with class "leaflet-container"
    await expect(page.locator('.leaflet-container').last()).toBeVisible({ timeout: 5000 });
  });

  test('map tab pre-shows pin when navigated from main map with URL params', async ({ page }) => {
    await page.route('*nominatim.openstreetmap.org/reverse*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ address: { road: 'Weber St', suburb: 'Kitchener' } })
      });
    });

    await page.goto('/report?lat=43.45&lng=-80.5');
    const modalBtn = page.getByRole('button', { name: /Show me the map/i });
    if (await modalBtn.isVisible()) await modalBtn.click();

    // Should auto-switch to map tab
    await expect(page.getByRole('tab', { name: /Pick on map/i }))
      .toHaveAttribute('aria-selected', 'true', { timeout: 3000 });

    // Map should be visible
    await expect(page.locator('.leaflet-container').last()).toBeVisible({ timeout: 5000 });
  });
});
```

**Step 2: Run to confirm it fails**

```bash
npx playwright test tests/e2e/report.spec.ts --grep "mini map tab"
```

Expected: FAIL — no map element in the report page.

**Step 3: Implement mini map panel**

Add to `<script>` in `src/routes/report/+page.svelte`:

```typescript
let miniMapEl: HTMLDivElement;
let miniMapRef: import('leaflet').Map | null = null;
let miniPinRef: import('leaflet').Marker | null = null;

// Called when the 'map' tab becomes active (use $effect)
$effect(() => {
  if (locationMode !== 'map') return;

  // Short delay lets the DOM render the map div before Leaflet mounts
  const timer = setTimeout(async () => {
    if (miniMapRef || !miniMapEl) return;

    await import('leaflet/dist/leaflet.css');
    const leafletModule = await import('leaflet');
    const L = leafletModule.default ?? leafletModule;

    const center: [number, number] = lat !== null && lng !== null
      ? [lat, lng]
      : [43.425, -80.42];

    const map = L.map(miniMapEl, { center, zoom: lat !== null ? 16 : 13 });
    miniMapRef = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    // If coords already set (from URL params), place pin immediately
    if (lat !== null && lng !== null) {
      miniPinRef = L.marker([lat, lng], { draggable: true }).addTo(map);
      miniPinRef.on('dragend', () => {
        const pos = miniPinRef!.getLatLng();
        lat = pos.lat;
        lng = pos.lng;
        reverseGeocode(pos.lat, pos.lng);
      });
    }

    map.on('click', (e) => {
      lat = e.latlng.lat;
      lng = e.latlng.lng;
      reverseGeocode(e.latlng.lat, e.latlng.lng);

      if (miniPinRef) {
        miniPinRef.setLatLng(e.latlng);
      } else {
        miniPinRef = L.marker(e.latlng, { draggable: true }).addTo(map);
        miniPinRef.on('dragend', () => {
          const pos = miniPinRef!.getLatLng();
          lat = pos.lat;
          lng = pos.lng;
          reverseGeocode(pos.lat, pos.lng);
        });
      }
    });
  }, 50);

  return () => clearTimeout(timer);
});
```

Replace the map panel placeholder with:

```svelte
{#if locationMode === 'map'}
  <div bind:this={miniMapEl} class="w-full rounded-lg overflow-hidden" style="height: 260px;"></div>
  {#if lat !== null}
    <p class="text-xs text-zinc-400">
      📌 {address ?? `${lat.toFixed(5)}, ${lng?.toFixed(5)}`}
      — drag the pin to adjust
    </p>
  {:else}
    <p class="text-xs text-zinc-500">Tap the map to place a pin</p>
  {/if}
{/if}
```

**Step 4: Run tests**

```bash
npx playwright test tests/e2e/report.spec.ts --grep "mini map tab"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/report/+page.svelte tests/e2e/report.spec.ts
git commit -m "feat: add mini Leaflet map pin-drop tab to report form"
```

---

### Task 5: Pin-drop mode on the main map

**Goal:** A "📍 Report here" button toggles pin-drop mode. Mode shows a crosshair cursor + top banner. Clicking the map places a draggable marker. A "Confirm location →" button navigates to `/report?lat=…&lng=…`.

**Files:**
- Modify: `src/routes/+page.svelte`
- Test: `tests/e2e/map-page.spec.ts`

**Step 1: Write the failing E2E test**

Add to `tests/e2e/map-page.spec.ts`:

```typescript
test.describe('Main map — report here mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const modalBtn = page.getByRole('button', { name: /Show me the map/i });
    if (await modalBtn.isVisible()) await modalBtn.click();
    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 5000 });
  });

  test('shows Report here button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Report here/i })).toBeVisible();
  });

  test('clicking Report here shows cancel banner', async ({ page }) => {
    await page.getByRole('button', { name: /Report here/i }).click();
    await expect(page.getByText(/Tap the map where the pothole is/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
  });

  test('cancel exits report mode', async ({ page }) => {
    await page.getByRole('button', { name: /Report here/i }).click();
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByText(/Tap the map where the pothole is/i)).toBeHidden();
  });
});
```

**Step 2: Run to confirm it fails**

```bash
npx playwright test tests/e2e/map-page.spec.ts --grep "report here mode"
```

Expected: FAIL — no "Report here" button exists.

**Step 3: Implement pin-drop mode on the main map**

Add to `<script>` in `src/routes/+page.svelte`:

```typescript
import { goto } from '$app/navigation';

let reportMode = $state(false);
let reportPin: import('leaflet').Marker | null = null;
let reportLatLng = $state<{ lat: number; lng: number } | null>(null);

function enterReportMode() {
  reportMode = true;
  if (mapRef) mapRef.getContainer().style.cursor = 'crosshair';
}

function exitReportMode() {
  reportMode = false;
  reportLatLng = null;
  if (mapRef) mapRef.getContainer().style.cursor = '';
  if (reportPin && mapRef) {
    mapRef.removeLayer(reportPin);
    reportPin = null;
  }
}

function confirmReportLocation() {
  if (!reportLatLng) return;
  goto(`/report?lat=${reportLatLng.lat}&lng=${reportLatLng.lng}`);
}
```

In the `onMount`, after `map.addLayer(markers)`, add the map click handler for report mode:

```typescript
map.on('click', (e) => {
  if (!reportMode) return;

  reportLatLng = { lat: e.latlng.lat, lng: e.latlng.lng };

  const L = LRef!;
  if (reportPin) {
    reportPin.setLatLng(e.latlng);
  } else {
    reportPin = L.marker(e.latlng, { draggable: true, zIndexOffset: 1000 })
      .addTo(map);
    reportPin.on('dragend', () => {
      const pos = reportPin!.getLatLng();
      reportLatLng = { lat: pos.lat, lng: pos.lng };
    });
  }
});
```

Note: the click handler checks `reportMode` which is a Svelte 5 `$state`. Since this is inside a closure that captures the reactive variable, use a getter to keep it current:

```typescript
// Replace: if (!reportMode) return;
// With a ref that stays current:
```

Actually, because Leaflet callbacks are closures that close over a stale value, we need a non-reactive ref. Add alongside the other `let` declarations:

```typescript
let reportModeRef = false;
$effect(() => { reportModeRef = reportMode; });
```

Then in the click handler use `reportModeRef` instead of `reportMode`.

**Step 4: Add the button and banner to the template**

Add "📍 Report here" to the bottom-left controls (after the existing two buttons):

```svelte
<button
  onclick={enterReportMode}
  class="bg-sky-700/90 backdrop-blur border border-sky-600 hover:border-sky-400 rounded-xl px-3 py-2 text-xs text-white font-semibold transition-colors flex items-center gap-1.5"
>
  📍 Report here
</button>
```

Add the banner just inside the outer `<div class="relative w-full">`, before the map div:

```svelte
{#if reportMode}
  <div class="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-3 bg-zinc-900/95 backdrop-blur border border-sky-600 rounded-xl px-4 py-2.5 shadow-xl">
    <span class="text-sm text-white">Tap the map where the pothole is</span>
    {#if reportLatLng}
      <button
        onclick={confirmReportLocation}
        class="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
      >
        Confirm location →
      </button>
    {/if}
    <button
      onclick={exitReportMode}
      class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded transition-colors"
      aria-label="Cancel"
    >
      ✕ Cancel
    </button>
  </div>
{/if}
```

**Step 5: Run tests**

```bash
npx playwright test tests/e2e/map-page.spec.ts --grep "report here mode"
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/routes/+page.svelte tests/e2e/map-page.spec.ts
git commit -m "feat: add pin-drop report mode to main map with crosshair and confirm banner"
```

---

### Task 6: Update copy + run full test suite

**Goal:** Update the help text at the bottom of the report form to reflect that GPS is no longer required. Verify nothing is broken.

**Files:**
- Modify: `src/routes/report/+page.svelte`

**Step 1: Update the footer copy**

Find the two `<p class="text-xs text-zinc-400 text-center">` paragraphs at the bottom of the form and replace:

```svelte
<!-- BEFORE -->
<p class="text-xs text-zinc-400 text-center">
  Reports require GPS. Three independent reports from the same location are needed before a pothole appears on the map.
</p>

<!-- AFTER -->
<p class="text-xs text-zinc-400 text-center">
  Three independent reports from the same location are needed before a pothole appears on the map.
</p>
```

**Step 2: Run the full test suite**

```bash
npx playwright test
```

Expected: all tests pass. Fix any regressions before proceeding.

**Step 3: Commit**

```bash
git add src/routes/report/+page.svelte
git commit -m "chore: remove GPS-required copy from report form footer"
```

---

### Task 7: Smoke test all three flows manually

Before considering this done, verify these flows work end-to-end in a real browser:

1. **GPS flow**: `/report` → GPS auto-fires → locked → submit enabled
2. **Address flow**: `/report` → Address tab → type "King St Waterloo" → pick suggestion → submit enabled
3. **Map tab flow**: `/report` → Pick on map tab → click map → pin placed → address reverse-geocoded → submit enabled
4. **Main map → report flow**: `/` → Report here button → click map → pin placed → Confirm location → lands on `/report?lat=…&lng=…` with map tab active and pin visible

```bash
npm run dev
# Open http://localhost:5173 and walk through all four flows
```

---

## Notes

- No API changes required — `/api/report` already accepts `lat`, `lng`, `address` from any source.
- Nominatim ToS: 1 req/s max. The 300ms debounce + 3-char minimum keeps us safe. The `User-Agent: fillthehole.ca` header is already in use for reverse geocoding and must be included on forward geocode requests too.
- The `reportModeRef` pattern (non-reactive mirror of `reportMode`) is needed because Leaflet event handlers close over values at bind time — Svelte 5's `$state` proxies don't help there.
- Both Leaflet instances (main map and mini map) are independent — no shared references.
