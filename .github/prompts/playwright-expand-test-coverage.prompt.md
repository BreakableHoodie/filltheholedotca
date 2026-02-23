---
agent: agent
description: 'Expand Playwright test coverage for fillthehole.ca — pothole detail page, geofence rejection, status transitions, WelcomeModal, and map smoke test'
tools: ['changes', 'codebase', 'edit/editFiles', 'fetch', 'findTestFiles', 'problems', 'runCommands', 'runTasks', 'runTests', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'testFailure', 'playwright']
mode: agent
---

Expand the Playwright test suite for fillthehole.ca.

**Dev server:** Run `npm run build && npm run preview` — the app runs at http://localhost:4173.

**What's already tested (do not duplicate):**
- Report form: GPS granted/denied/no-GPS states, severity selection, submission success/failure, redirect
- Navigation: all routes load, nav links, feed and wards.geojson APIs
- Stats page: filters, stat cards, chart, leaderboard sections
- A11y: axe WCAG 2.1 AA scans on home/report/about, reflow at 320px

**Gaps to fill — in priority order:**

1. **Pothole detail page** (`/hole/[id]`)
   - Loads with a valid ID (fetch a real one from `/api/feed.json` first)
   - Displays status badge, coordinates, description
   - Shows councillor contact block (ward name, email link)
   - "Confirm this hole" button is present when status is `reported`
   - Share button/link is present

2. **Geofence rejection**
   - POST to `/api/report` with coordinates outside Waterloo Region (e.g. lat: 43.7, lng: -79.4 — Toronto)
   - Expects a 422 or 400 response with a rejection message
   - POST with coordinates just inside the boundary — expects 200

3. **Wanksy and filled API flows**
   - POST to `/api/wanksy` with a valid pothole ID (mock the DB response) — expects 200
   - POST to `/api/filled` with a valid pothole ID (mock the DB response) — expects 200
   - POST to either with a missing or malformed ID — expects 400 or 422

4. **WelcomeModal first-visit behaviour**
   - Visit `/` with no `fth-welcomed` key in localStorage
   - Modal is visible and traps focus
   - Clicking "Show me the map" dismisses it and sets the localStorage key
   - Subsequent visit (key present) — modal does not appear

5. **Map page smoke test**
   - Map container renders (the Leaflet div is present and has non-zero dimensions)
   - "Locate me" button is present in the UI

**Conventions in this codebase:**
- Tests live in `tests/e2e/` (new files go here)
- Uses `storageState` to pre-seed localStorage where needed (see existing `navigation.spec.ts` pattern)
- WelcomeModal is suppressed by setting `fth-welcomed: '1'` in storageState
- API routes are mocked with `page.route()` to avoid real DB writes
- Prefer `getByRole` locators; fall back to `getByText` or `locator()` only when necessary
- TypeScript throughout — no `any`, proper Playwright types
