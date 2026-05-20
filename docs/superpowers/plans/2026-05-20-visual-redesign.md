# Visual Redesign — Civic Data Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AI-SaaS visual design (zinc + sky-500 + rounded-2xl + tracking-label pattern) with a Civic Data Portal aesthetic — warm stone palette, amber-500 accent, system-adaptive dark mode, bordered card surfaces, and weight-based label hierarchy.

**Architecture:** Pure visual refactor — no logic, API, or data changes. All changes are Tailwind utility classes and CSS custom properties. Dark mode uses `prefers-color-scheme` media query via Tailwind v4's built-in `dark:` variant (no JS toggle required).

**Tech Stack:** SvelteKit, Tailwind CSS v4, `src/app.css` for global tokens.

**Spec:** `docs/superpowers/specs/2026-05-20-visual-redesign-design.md`

---

## File Map

| File | Change |
|------|--------|
| `src/app.css` | Add warm-charcoal token, update focus ring, fix Barlow Condensed `.page-title`, remove duplicate safe-area rules |
| `src/routes/+layout.svelte` | Nav, header, footer — zinc→stone, sky→amber, rounded-lg→rounded-md |
| `src/lib/components/HomeIntroCard.svelte` | Remove icon halos + step cards, bordered surface, amber CTA |
| `src/routes/report/+page.svelte` | Form cards, tab bar, GPS button, inputs, severity cards, submit button |
| `src/routes/hole/[id]/+page.svelte` | Status badge outlined, zinc→stone surfaces, amber action buttons |
| `src/routes/stats/+page.svelte` | Bordered surfaces, amber accent, time-filter buttons |
| `src/routes/about/+page.svelte` | Text colours, bordered cards, amber accent |
| `src/routes/how-to/+page.svelte` | Bordered legend cards, step icons, text colours |
| `src/routes/+page.svelte` | Mobile tool tray, homepage overlay colours |
| `src/routes/hole/[id]/+page.svelte` | Status badge — outlined inline (STATUS_CONFIG only has icon colours) |

---

## Task 1: CSS Foundation — Tokens & Dark Mode

**Files:**
- Modify: `src/app.css`

- [ ] **Step 1: Update `@theme` block to add warm-charcoal custom colour and remove stale asphalt tokens**

  Replace the entire `@theme` block in `src/app.css`:

  ```css
  @theme {
    --font-sans: "Public Sans", system-ui, sans-serif;
    --font-brand: "Barlow Condensed", system-ui, sans-serif;
    --color-asphalt: #191714;
  }
  ```

  (`--color-asphalt-light` removed — unused after this redesign. `--color-asphalt` is now the warm dark base used in dark mode.)

- [ ] **Step 2: Update focus ring from sky-500 to amber-500**

  In `src/app.css`, change:

  ```css
  :focus-visible {
    outline: 2px solid #f59e0b; /* amber-500 */
    outline-offset: 2px;
  }
  ```

- [ ] **Step 3: Update `.page-title` to use Barlow Condensed and fix `.section-title`**

  Replace the `.page-title` and `.section-title` blocks:

  ```css
  .page-title {
    font-family: var(--font-brand);
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1;
    text-wrap: balance;
  }

  .section-title {
    font-family: var(--font-brand);
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1.1;
    text-wrap: balance;
  }
  ```

- [ ] **Step 4: Remove duplicate safe-area rules**

  Lines 89–99 of `src/app.css` repeat `.safe-header`, `.safe-header-inner`, and `.safe-bottom` verbatim from lines 63–73. Delete lines 89–99 (the second block).

- [ ] **Step 5: Verify the dev server starts without errors**

  ```bash
  npm run dev
  ```

  Expected: server starts at http://localhost:5173 with no CSS parse errors in the terminal.

- [ ] **Step 6: Commit**

  ```bash
  git add src/app.css
  git commit -m "style: update CSS tokens — amber focus ring, Barlow Condensed headings, warm-charcoal token"
  ```

---

## Task 2: Layout — Nav, Header, Footer

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Update body wrapper background**

  In `src/routes/+layout.svelte` line 33, change:

  ```svelte
  <div class="flex flex-col min-h-screen bg-stone-50 dark:bg-asphalt">
  ```

- [ ] **Step 2: Update skip link**

  Line 37–39, change `bg-sky-600` to `bg-amber-500`:

  ```svelte
  class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:bg-amber-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:font-semibold focus:outline-none"
  ```

- [ ] **Step 3: Update header surface**

  Line 42, change:

  ```svelte
  <header class="bg-white border-b border-stone-200 dark:bg-stone-900 dark:border-stone-700 sticky top-0 z-50 safe-header">
  ```

- [ ] **Step 4: Update wordmark accent colour**

  Line 48–50, change `text-sky-500` to `text-amber-500` and `group-hover:text-sky-400` to `group-hover:text-amber-400`:

  ```svelte
  <span class="font-brand font-bold text-xl leading-none text-stone-900 dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
    FillTheHole<span class="text-amber-500">.ca</span>
  </span>
  ```

- [ ] **Step 5: Update live stat text colours**

  Lines 55–65, change `text-zinc-300` → `text-stone-600 dark:text-stone-300`, `text-white` → `text-stone-900 dark:text-white`, `text-zinc-700` → `text-stone-300 dark:text-stone-600`:

  ```svelte
  <div class="hidden sm:flex items-center gap-3 text-sm" aria-label="Pothole statistics">
    <span class="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
      <span class="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
      <span class="text-stone-900 dark:text-white font-semibold tabular-nums">{counts.reported}</span>
      reported
    </span>
    <span class="text-stone-300 dark:text-stone-600" aria-hidden="true">·</span>
    <span class="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
      <span class="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
      <span class="text-stone-900 dark:text-white font-semibold tabular-nums">{counts.filled}</span>
      filled
    </span>
  </div>
  ```

- [ ] **Step 6: Update nav links**

  Lines 70–87, change `text-zinc-300 hover:text-white` → `text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white` on all nav links:

  ```svelte
  <a href="/stats" class="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-colors">
    Stats
  </a>
  <a href="/how-to" class="hidden sm:inline text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-colors">
    How to
  </a>
  <a href="/about" class="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-colors">
    About
  </a>
  <a
    href="https://github.com/BreakableHoodie/filltheholedotca"
    target="_blank"
    rel="noopener noreferrer"
    class="hidden sm:inline-flex text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-colors"
    aria-label="View source on GitHub"
  >
    <Icon name="github" size={18} />
  </a>
  ```

- [ ] **Step 7: Update CTA button**

  Lines 88–94, change `bg-sky-700 hover:bg-sky-600 rounded-lg` → `bg-amber-500 hover:bg-amber-600 rounded-md`:

  ```svelte
  <a
    href="/report"
    class="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3.5 py-2 rounded-md transition-colors whitespace-nowrap text-sm"
  >
    <Icon name="plus" size={14} strokeWidth={2.5} />
    Report a pothole
  </a>
  ```

- [ ] **Step 8: Update footer**

  Line 104, change:

  ```svelte
  <footer class="bg-white border-t border-stone-200 dark:bg-stone-900 dark:border-stone-700 py-5 text-center text-stone-500 dark:text-stone-400 text-xs px-4 space-y-1.5">
  ```

  Lines 108–116, change link colours from `text-zinc-300 hover:text-white` → `text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white` and separators from `text-zinc-600` → `text-stone-300 dark:text-stone-600`:

  ```svelte
  <p>Track potholes. Contact your councillor. Hold the city accountable.</p>
  <p>
    Community-sourced data — not official. Use at your own risk.
    <a href="/how-to" class="underline hover:text-stone-900 dark:hover:text-white transition-colors">How to use</a>
    <span class="mx-1 text-stone-300 dark:text-stone-600" aria-hidden="true">·</span>
    <a href="/about#privacy" class="underline hover:text-stone-900 dark:hover:text-white transition-colors">Privacy</a>
    <span class="mx-1 text-stone-300 dark:text-stone-600" aria-hidden="true">·</span>
    <a href="/about#disclaimer" class="underline hover:text-stone-900 dark:hover:text-white transition-colors">Disclaimer</a>
    <span class="mx-1 text-stone-300 dark:text-stone-600" aria-hidden="true">·</span>
    <a href="https://github.com/BreakableHoodie/filltheholedotca" target="_blank" rel="noopener noreferrer" class="underline hover:text-stone-900 dark:hover:text-white transition-colors">GitHub</a>
    <span class="mx-1 text-stone-300 dark:text-stone-600" aria-hidden="true">·</span>
    <a href="https://github.com/BreakableHoodie/filltheholedotca/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" class="underline hover:text-stone-900 dark:hover:text-white transition-colors">AGPL-3.0</a>
  </p>
  ```

- [ ] **Step 9: Verify in browser**

  Open http://localhost:5173. Confirm:
  - Header is white (light mode) with stone border
  - Wordmark shows amber `.ca`
  - "Report a pothole" button is amber
  - Nav links are stone-grey
  - Footer is white with stone border

  To verify dark mode: in Chrome DevTools → Rendering → Emulate CSS media feature `prefers-color-scheme: dark`. Confirm header and footer flip to stone-900.

- [ ] **Step 10: Commit**

  ```bash
  git add src/routes/+layout.svelte
  git commit -m "style: nav/header/footer — stone palette, amber accent, system-adaptive dark mode"
  ```

---

## Task 3: HomeIntroCard — Remove AI Design Tells

**Files:**
- Modify: `src/lib/components/HomeIntroCard.svelte`

- [ ] **Step 1: Rewrite the card surface and label**

  Replace the outer card div and label (lines 57–61):

  ```svelte
  <div class="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md p-5 shadow-xl">
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-2">
        <p class="text-xs font-semibold text-stone-500 dark:text-stone-400">Waterloo Region civic tool</p>
        <h2 id="welcome-title" class="page-title text-3xl text-stone-900 dark:text-white">Report a pothole in about 30 seconds</h2>
        <p class="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
          Independent community tracker for Kitchener, Waterloo, and Cambridge.
          No account required.
        </p>
      </div>
      <button
        type="button"
        onclick={dismiss}
        class="rounded-md p-2 text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        aria-label="Dismiss introduction"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  ```

- [ ] **Step 2: Replace step cards with simple bordered list**

  Remove the `STEPS` array and the `{#each STEPS}` block entirely. Replace with:

  ```svelte
  <ol class="mt-4 space-y-3 text-sm">
    <li class="flex gap-3 items-start border-l-2 border-amber-500 pl-3">
      <div>
        <span class="font-semibold text-stone-900 dark:text-white">Report</span>
        <span class="text-stone-500 dark:text-stone-400"> — confirm the location and submit. Nearby reports are merged.</span>
      </div>
    </li>
    <li class="flex gap-3 items-start border-l-2 border-amber-500 pl-3">
      <div>
        <span class="font-semibold text-stone-900 dark:text-white">Contact</span>
        <span class="text-stone-500 dark:text-stone-400"> — email your ward councillor directly from the pothole page.</span>
      </div>
    </li>
    <li class="flex gap-3 items-start border-l-2 border-amber-500 pl-3">
      <div>
        <span class="font-semibold text-stone-900 dark:text-white">Track</span>
        <span class="text-stone-500 dark:text-stone-400"> — once the city fills it, mark it done.</span>
      </div>
    </li>
  </ol>
  ```

  Also remove the `import Icon` line and the `STEPS` constant from the `<script>` block, since Icon is no longer used in this component. Keep `onMount` and `dismiss`.

  Wait — `Icon` is still used in the dismiss button. Keep the import.

- [ ] **Step 3: Update CTA buttons**

  Replace lines 91–107:

  ```svelte
  <div class="mt-4 flex flex-col sm:flex-row gap-2">
    <a
      href="/report"
      onclick={dismiss}
      class="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-600"
    >
      Report a pothole
    </a>
    <a
      href="/about"
      onclick={dismiss}
      class="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 dark:border-stone-600 px-4 py-3 text-sm font-semibold text-stone-700 dark:text-stone-300 transition-colors hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white"
    >
      Learn how it works
    </a>
  </div>

  <p class="mt-3 text-xs text-stone-500 dark:text-stone-400">
    Community-run and open source. For official action, report to the city too.
  </p>
  ```

- [ ] **Step 4: Verify in browser**

  Open http://localhost:5173. The intro card (if first visit — clear localStorage or use a private window) should show:
  - White card with stone border (light) / stone-900 with stone-700 border (dark)
  - No icon halos
  - Simple bordered list with amber left border
  - Amber "Report a pothole" button

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/components/HomeIntroCard.svelte
  git commit -m "style(home): remove icon halos and step cards from intro card; amber-bordered list"
  ```

---

## Task 4: Report Form

**Files:**
- Modify: `src/routes/report/+page.svelte`

- [ ] **Step 1: Update page text colours**

  Lines 440–446, change `text-white` → `text-stone-900 dark:text-white`, `text-zinc-300` → `text-stone-600 dark:text-stone-300`:

  ```svelte
  <h1 class="page-title text-3xl sm:text-4xl text-stone-900 dark:text-white mb-1">Report a pothole</h1>
  <p class="page-intro text-stone-600 dark:text-stone-300 text-sm">Report the location in about 30 seconds. No account required.</p>
  <p class="text-xs text-stone-600 dark:text-stone-300 mt-2">Independent community tracker for Waterloo Region. For official repair action, report to the city too.</p>
  <p class="flex items-start gap-1.5 text-xs text-stone-600 dark:text-stone-300 mt-2">
    <Icon name="alert-triangle" size={13} class="text-amber-500 shrink-0 mt-0.5" />
    Stay safe — report from the sidewalk or after pulling over. Never stop in a live traffic lane.
  </p>
  ```

- [ ] **Step 2: Update location card surface**

  Line 451, change:

  ```svelte
  <div class="border border-stone-200 dark:border-stone-700 rounded-md bg-white dark:bg-stone-900 p-4 space-y-3">
  ```

- [ ] **Step 3: Update location card label and tab bar**

  Lines 452–478:

  ```svelte
  <div class="flex items-center gap-2 text-sm font-semibold text-stone-700 dark:text-stone-300">
    <Icon name="crosshair" size={14} class="text-amber-500" />
    Location
  </div>
  <p class="text-xs text-stone-500 dark:text-stone-400">Use your current location for the fastest report, or switch to address search or map pin if needed.</p>

  <div role="tablist" aria-label="Choose a location source" class="flex gap-1 bg-stone-100 dark:bg-stone-800 rounded-md p-1">
    {#each LOCATION_TABS as tab (tab.mode)}
      <button
        id={`location-tab-${tab.mode}`}
        role="tab"
        aria-selected={locationMode === tab.mode}
        aria-controls={`location-panel-${tab.mode}`}
        tabindex={locationMode === tab.mode ? 0 : -1}
        type="button"
        onclick={() => (locationMode = tab.mode)}
        onkeydown={(event) => handleLocationTabKeydown(event, tab.mode)}
        class="flex-1 min-h-[44px] py-1.5 px-2 rounded-sm text-xs font-semibold transition-colors
          {locationMode === tab.mode
            ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm'
            : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'}"
      >
        {tab.label}
      </button>
    {/each}
  </div>
  ```

- [ ] **Step 4: Update GPS button**

  Lines 488–512, change `border-zinc-700 hover:border-sky-500 hover:bg-sky-500/5 text-zinc-400 hover:text-sky-400` → amber equivalents:

  ```svelte
  <button
    type="button"
    onclick={getLocation}
    disabled={gpsStatus === 'loading'}
    class="w-full py-3 rounded-md border-2 border-dashed font-semibold text-sm transition-colors flex items-center justify-center gap-2
      {gpsStatus === 'got'
        ? 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'
        : gpsStatus === 'error'
        ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
        : 'border-stone-300 dark:border-stone-600 hover:border-amber-500 hover:bg-amber-500/5 text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400'}"
  >
  ```

- [ ] **Step 5: Update address input**

  Line 565:

  ```svelte
  class="w-full bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-md px-3 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:border-amber-500"
  ```

- [ ] **Step 6: Grep for remaining zinc/sky references in this file and fix them**

  ```bash
  grep -n "zinc\|sky-[5-9]" src/routes/report/+page.svelte
  ```

  For each remaining instance, apply the pattern: `zinc-[number]` → `stone-[same-number]`, `bg-sky-` → `bg-amber-`, `text-sky-` → `text-amber-`, `border-sky-` → `border-amber-`.

  Exception: `border-green-`, `bg-red-`, `border-red-` — leave these as-is (status colours).

- [ ] **Step 7: Update submit button (near the bottom of the template)**

  Find the submit button (search for `submitting`). Change from `bg-sky-700` or similar to:

  ```svelte
  class="w-full py-3 rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
  ```

- [ ] **Step 8: Verify in browser**

  Open http://localhost:5173/report. Confirm:
  - Location card has white/stone-200 border (not zinc)
  - Tab bar is stone-100 background
  - GPS button uses amber hover
  - Submit button is amber

- [ ] **Step 9: Commit**

  ```bash
  git add src/routes/report/+page.svelte
  git commit -m "style(report): stone surfaces, amber accent, updated form inputs and GPS button"
  ```

---

## Task 5: Pothole Detail Page

**Files:**
- Modify: `src/routes/hole/[id]/+page.svelte`

- [ ] **Step 1: Grep for zinc and sky-accent references**

  ```bash
  grep -n "zinc\|sky-[5-9]\|rounded-xl\|rounded-2xl" src/routes/hole/[id]/+page.svelte | head -50
  ```

- [ ] **Step 2: Update surface cards**

  For every `bg-zinc-900 border-zinc-800 rounded-xl` or similar card, change to:

  ```svelte
  bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md
  ```

- [ ] **Step 3: Update text colours**

  - `text-zinc-400`, `text-zinc-300` → `text-stone-500 dark:text-stone-400`
  - `text-white` headings → `text-stone-900 dark:text-white`
  - `text-zinc-200` → `text-stone-700 dark:text-stone-200`

- [ ] **Step 4: Update inline status badges**

  `STATUS_CONFIG` in `src/lib/constants.ts` only controls icon colours — badge styling is inline in this template. Grep for `bg-orange-500/10`, `bg-sky-500/10`, `bg-green-500/10`, `rounded-full` to find status display elements. Convert filled pills to outlined badges:

  ```svelte
  <!-- Before (filled pill): -->
  <span class="rounded-full bg-orange-500/10 text-orange-400 text-xs px-2 py-0.5">Reported</span>

  <!-- After (outlined): -->
  <span class="rounded border border-orange-500 text-orange-600 dark:text-orange-400 text-xs font-semibold px-1.5 py-0.5">Reported</span>
  ```

  Per-status border/text colours:
  - `pending`: `border-orange-500 text-orange-600 dark:text-orange-400`
  - `reported`: `border-sky-500 text-sky-600 dark:text-sky-400`
  - `filled`: `border-green-500 text-green-600 dark:text-green-400`
  - `expired`: `border-stone-400 text-stone-500`

  Leave the progress bar (`bg-sky-500 rounded-full`) unchanged — it's a functional indicator, not a badge.

- [ ] **Step 5: Update action buttons**

  Any `bg-sky-700 hover:bg-sky-600` → `bg-amber-500 hover:bg-amber-600`, `rounded-lg` → `rounded-md`.
  Any `border-zinc-700` secondary buttons → `border-stone-300 dark:border-stone-600`.

- [ ] **Step 6: Update icon accent colours**

  `text-sky-400` icons → `text-amber-500`. Leave `text-green-400`, `text-orange-400`, `text-red-400` — those are status colours.

- [ ] **Step 7: Verify in browser**

  Open any pothole detail page (e.g., http://localhost:5173/hole/[any-id-from-homepage]). Confirm surface cards, action buttons, and status badge match the new design.

- [ ] **Step 8: Commit**

  ```bash
  git add src/routes/hole/[id]/+page.svelte
  git commit -m "style(detail): stone surfaces, outlined status badge, amber action buttons"
  ```

---

## Task 6: Stats Dashboard

**Files:**
- Modify: `src/routes/stats/+page.svelte`

- [ ] **Step 1: Grep for zinc and sky references**

  ```bash
  grep -n "zinc\|sky-[5-9]\|rounded-xl\|rounded-2xl" src/routes/stats/+page.svelte | head -50
  ```

- [ ] **Step 2: Update metric cards**

  Every `bg-zinc-900 border-zinc-800 rounded-xl` → `bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md`.

- [ ] **Step 3: Update time-window filter buttons**

  Find the `WINDOWS` filter buttons. Change active state from `bg-zinc-800` / `bg-sky-600` to:

  ```svelte
  {windowDays === w.value
    ? 'bg-amber-500 text-white'
    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'}
  ```

  Add `rounded-md` to the button class.

- [ ] **Step 4: Update text colours**

  - `text-zinc-400` → `text-stone-500 dark:text-stone-400`
  - `text-white` numbers/headings → `text-stone-900 dark:text-white`

- [ ] **Step 5: Update chart/bar accent**

  Any `bg-sky-500` chart bars → `bg-amber-500`. Leave `bg-green-500` fill bars as-is.

- [ ] **Step 6: Verify in browser**

  Open http://localhost:5173/stats. Confirm metric cards have stone borders, filter buttons are amber when active.

- [ ] **Step 7: Commit**

  ```bash
  git add src/routes/stats/+page.svelte
  git commit -m "style(stats): stone bordered cards, amber filter buttons and chart accent"
  ```

---

## Task 7: About Page

**Files:**
- Modify: `src/routes/about/+page.svelte`

- [ ] **Step 1: Update page heading and body text colours**

  Line 14: `text-white` → `text-stone-900 dark:text-white`
  Line 15: `text-zinc-400` → `text-stone-600 dark:text-stone-400`
  Throughout: `text-zinc-300` → `text-stone-600 dark:text-stone-300`, `text-white` section headings → `text-stone-900 dark:text-white`

- [ ] **Step 2: Update the "Report it officially too" card**

  Line 35: `bg-zinc-900 border border-zinc-700 rounded-xl` → `bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-md`

- [ ] **Step 3: Update accent text**

  Line 30: `text-sky-300 font-medium` → `text-amber-600 dark:text-amber-400 font-medium`

- [ ] **Step 4: Update icon colours**

  `text-sky-400` → `text-amber-500` on all Icon components.

- [ ] **Step 5: Grep and fix remaining zinc references**

  ```bash
  grep -n "zinc\|sky-[5-9]\|rounded-xl" src/routes/about/+page.svelte
  ```

  Fix each remaining instance.

- [ ] **Step 6: Verify in browser**

  Open http://localhost:5173/about. Confirm body text is readable in both light and dark mode.

- [ ] **Step 7: Commit**

  ```bash
  git add src/routes/about/+page.svelte
  git commit -m "style(about): stone text colours, amber accent, bordered official-links card"
  ```

---

## Task 8: How-to Page

**Files:**
- Modify: `src/routes/how-to/+page.svelte`

- [ ] **Step 1: Update page heading and body text**

  `text-white` headings → `text-stone-900 dark:text-white`
  `text-zinc-400` body → `text-stone-600 dark:text-stone-400`

- [ ] **Step 2: Update status legend cards**

  Lines 27–38 (the colour-coded status legend `div` rows): change `bg-zinc-900 border border-zinc-800 rounded-lg` → `border border-stone-200 dark:border-stone-700 rounded-md` with no background fill — let the surface inherit.

  ```svelte
  <div class="flex items-center gap-3 border border-stone-200 dark:border-stone-700 rounded-md px-4 py-3">
  ```

- [ ] **Step 3: Update section icon colours**

  `text-sky-400` → `text-amber-500` on all `<Icon>` components.

- [ ] **Step 4: Grep and fix remaining zinc references**

  ```bash
  grep -n "zinc\|sky-[5-9]\|rounded-xl" src/routes/how-to/+page.svelte
  ```

  Fix each remaining instance.

- [ ] **Step 5: Verify in browser**

  Open http://localhost:5173/how-to. Confirm legend cards have stone borders, icons are amber.

- [ ] **Step 6: Commit**

  ```bash
  git add src/routes/how-to/+page.svelte
  git commit -m "style(how-to): stone legend cards, amber icons, text colour updates"
  ```

---

## Task 9: Homepage Map Page

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Grep for zinc and sky references in the homepage**

  ```bash
  grep -n "zinc\|sky-[5-9]\|rounded-xl\|rounded-2xl" src/routes/+page.svelte | head -60
  ```

- [ ] **Step 2: Update mobile tool tray**

  Find the mobile tool tray component (floats over the map). Update surface: `bg-zinc-900/95 border-zinc-800` → `bg-white/95 dark:bg-stone-900/95 border-stone-200 dark:border-stone-700 backdrop-blur-sm`.
  Update tray button active states from sky/zinc to amber/stone.

- [ ] **Step 3: Update map overlay UI elements**

  Any floating panels or cards over the map: `bg-zinc-900 rounded-xl` → `bg-white dark:bg-stone-900 rounded-md border border-stone-200 dark:border-stone-700`.
  Text colours: zinc → stone equivalents.

- [ ] **Step 4: Leave Leaflet map elements unchanged**

  Leaflet injects its own CSS. Do not attempt to style `.leaflet-*` classes here — that's a separate concern outside this spec.

- [ ] **Step 5: Verify in browser**

  Open http://localhost:5173. Confirm the mobile tool tray and any map overlays use stone/amber instead of zinc/sky.

- [ ] **Step 6: Commit**

  ```bash
  git add src/routes/+page.svelte
  git commit -m "style(home): mobile tool tray and map overlays — stone surface, amber active states"
  ```

---

## Task 10: Global Sweep — Catch Remaining Instances

**Files:**
- Any remaining `src/` files

- [ ] **Step 1: Find all remaining zinc references in `src/`**

  ```bash
  grep -rn "zinc-" src/ --include="*.svelte" --include="*.ts" --include="*.css" | grep -v "node_modules"
  ```

- [ ] **Step 2: Find all remaining rounded-xl/2xl references**

  ```bash
  grep -rn "rounded-xl\|rounded-2xl" src/ --include="*.svelte"
  ```

- [ ] **Step 3: Find remaining sky-accent references (not status colours)**

  ```bash
  grep -rn "bg-sky-\|text-sky-[4-9]\|border-sky-" src/ --include="*.svelte"
  ```

  Note: `text-sky-` on status badges for "reported" potholes is intentional — do not change those. Only change sky as an accent colour (buttons, icons, links).

- [ ] **Step 4: Fix each remaining instance using the established patterns**

  For each file returned:
  - `bg-zinc-[N]` → `bg-stone-[N]` (or `bg-asphalt` for the darkest bg)
  - `border-zinc-[N]` → `border-stone-[N]`
  - `text-zinc-[N]` → `text-stone-[N]`
  - `bg-sky-[5-7]` accent → `bg-amber-[4-6]`
  - `text-sky-[3-5]` accent → `text-amber-[4-6]`
  - `rounded-xl` interactive → `rounded-md`
  - `rounded-2xl` cards → `rounded-md`

- [ ] **Step 5: Verify build passes**

  ```bash
  npm run build 2>&1 | tail -20
  ```

  Expected: build completes with no errors.

- [ ] **Step 6: Final visual walkthrough**

  Open http://localhost:5173. Walk through:
  1. Homepage (map + intro card)
  2. Report form
  3. A pothole detail page
  4. Stats
  5. About
  6. How-to

  For each, toggle dark mode via DevTools → Rendering → `prefers-color-scheme: dark`. Confirm nothing is invisible (white-on-white, black-on-black).

- [ ] **Step 7: Commit**

  ```bash
  git add -p  # review and stage remaining changes
  git commit -m "style: sweep remaining zinc/sky/rounded-xl instances across all pages"
  ```

---

## Task 11: PR

- [ ] **Step 1: Push branch and open PR**

  ```bash
  git push origin fix/mobile-ux-bluesky
  gh pr create \
    --title "style: Civic Data Portal visual redesign — stone/amber, system dark mode, bordered surfaces" \
    --body "$(cat <<'EOF'
  ## Summary

  - Replaces AI-SaaS visual pattern (zinc + sky-500 + rounded-2xl + tracking labels) with Civic Data Portal aesthetic
  - Stone palette replaces zinc (warm concrete undertone vs synthetic cool grey)
  - Amber-500 replaces sky-500 as primary accent (road marking semantic connection)
  - System-adaptive dark mode via `prefers-color-scheme` — no JS toggle required
  - Bordered card surfaces replace filled zinc backgrounds (document-like, not dashboard-like)
  - `uppercase tracking-[0.18em]` label pattern removed; weight hierarchy used instead
  - `rounded-xl`/`rounded-2xl` capped at `rounded-md` throughout
  - HomeIntroCard step cards replaced with amber-bordered list (no icon halos)
  - Status badges switched to outlined pattern
  - All pages updated: home, report, detail, stats, about, how-to

  ## Test plan

  - [ ] Light mode visual walkthrough: home, report, detail, stats, about, how-to
  - [ ] Dark mode walkthrough (DevTools → Rendering → prefers-color-scheme: dark)
  - [ ] Mobile viewport check (375px)
  - [ ] Intro card appears on first visit (clear localStorage), dismisses correctly
  - [ ] Report form submits successfully
  - [ ] `npm run build` passes

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```
