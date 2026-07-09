> **Status: Shipped** — implemented; retained for historical context.

# Visual Redesign — Civic Data Portal

**Date:** 2026-05-20  
**Status:** Approved — pending implementation plan

## Problem

The site's current visual design reads as a generic AI-generated dark SaaS dashboard: zinc palette, sky-500 accent, rounded-2xl cards, `uppercase tracking-[0.18em] text-xs` labels, and filled card backgrounds. None of these choices are distinctive or connected to the subject matter (civic infrastructure, Waterloo Region roads).

## Direction: Civic Data Portal

Reference: 18F, mySociety, well-made regional transit trackers. Data-legible, purposeful, clearly a public tool — not an app.

## Design System

### Color Palette

System-adaptive: light by default, dark mode respects `prefers-color-scheme`. Defined as CSS custom properties in `src/app.css`, applied via Tailwind v4 utility classes.

**Light mode:**
```css
--color-bg:       #fafaf9   /* stone-50 */
--color-surface:  #ffffff
--color-border:   #e7e5e4   /* stone-200 */
--color-text:     #1c1917   /* stone-900 */
--color-muted:    #78716c   /* stone-500 */
--color-accent:   #f59e0b   /* amber-500 */
--color-accent-hover: #d97706  /* amber-600 */
```

**Dark mode:**
```css
--color-bg:       #191714   /* custom warm charcoal — not zinc */
--color-surface:  #1c1917   /* stone-900 */
--color-border:   #44403c   /* stone-700 */
--color-text:     #f5f5f4   /* stone-100 */
--color-muted:    #a8a29e   /* stone-400 */
--color-accent:   #fbbf24   /* amber-400 */
--color-accent-hover: #f59e0b  /* amber-500 */
```

**Semantic / status colours** (same in both modes, backgrounds differ):
- Pending: `orange-500` text, `orange-50` bg (light) / `orange-500/15` bg (dark)
- Reported/confirmed: `sky-600` text, `sky-50` bg (light) / `sky-500/15` bg (dark)
- Filled: `green-600` text, `green-50` bg (light) / `green-500/15` bg (dark)
- Expired: `stone-500` text, `stone-100` bg (light) / `stone-500/15` bg (dark)

**Rationale for amber over sky-500:** sky-500 is the dominant AI-generated accent colour. Amber connects semantically to road markings, caution signage, and construction — the actual subject matter.

**Rationale for stone over zinc:** Both are neutral greys; stone has a faint warm undertone that reads as concrete/paper/pavement. Zinc reads synthetic.

### Typography

Typefaces stay (already loaded via @fontsource):
- **Barlow Condensed** — brand/headings only (site name, page titles, section headers)
- **Public Sans** — all UI text, body, labels, data

**What changes:**

Remove `uppercase tracking-[0.18em] text-xs` label pattern everywhere. This is the most visible AI design tell. Replace with weight hierarchy:

```
Before: text-xs uppercase tracking-[0.18em] text-zinc-400
After:  text-xs font-semibold text-stone-500
```

Apply tabular-nums to all numeric data displays (`font-variant-numeric: tabular-nums`).

### Component Patterns

**Cards / surfaces:**
```
Before: rounded-xl bg-zinc-900 border border-zinc-800
After:  rounded-md border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900
```

Document-like, not SaaS-like. Borders define surfaces; background fills do not.

**Buttons (primary):**
```
Before: bg-sky-700 rounded-xl
After:  bg-amber-500 hover:bg-amber-600 text-white rounded-md font-semibold
```

**Buttons (secondary/ghost):**
```
Before: rounded-xl border-zinc-700
After:  rounded-md border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300
```

**Status badges:**
```
Before: rounded-full bg-orange-500/10 text-orange-400 (filled pill)
After:  rounded border border-current text-xs font-semibold px-1.5 py-0.5 (outlined)
```

**Icon halos:** Remove `bg-[colour]/10` rounded icon backgrounds entirely. Icons appear inline or with plain colour, no halo.

**Border radius cap:** `rounded-md` (6px) maximum across all interactive elements. `rounded-full` only for circular avatar/indicator dots.

**Section dividers:** Explicit `border-b border-stone-200 dark:border-stone-700` lines, not implied by card background contrast.

## Page-by-Page Spec

### Navigation (`+layout.svelte`)

```
Before: bg-zinc-900 border-zinc-800 (sticky header)
After:  bg-white border-stone-200 dark:bg-stone-900 dark:border-stone-700
```

- "fillthehole.ca" wordmark: Barlow Condensed, stone-900/stone-100
- Nav links: Public Sans, stone-600/stone-400, hover underline
- "Report a Pothole" CTA: amber-500, rounded-md
- Live stat indicator dots (orange/green pulses): unchanged — functional signal

### Homepage / Map (`+page.svelte`)

- Leaflet map: unchanged
- `HomeIntroCard`: replace step cards (bg-zinc-900/rounded-xl with orange-500/10 icon halos) with a single short sentence in a minimal bordered card. Dismissible on first visit (existing localStorage behaviour stays).
- Mobile tool tray: stone borders, amber-500 active states

### Report Form (`report/+page.svelte`)

- Single-column layout, generous vertical spacing
- Severity selector: outlined bordered options, amber-500 selected state
- GPS status: drop tracking/uppercase label; use `text-xs font-semibold text-stone-500`
- Submit button: amber-500 rounded-md
- Form card: bordered surface (no filled background)

### Pothole Detail (`hole/[id]/+page.svelte`)

- Status badge: outlined, not filled pill
- Councillor card: simple bordered surface
- Action buttons (confirm, mark filled): amber-500 rounded-md
- Photo gallery: unchanged functionally; cards get bordered-surface treatment

### Stats Dashboard (`stats/+page.svelte`)

- Metric cards: bordered surface treatment
- Numbers: tabular-nums
- Ward leaderboard: simple bordered table rows instead of card grid where possible
- Charts/bars: amber accent

### About / How-to (`about/`, `how-to/`)

- Numbered step cards → simple `<ol>` with left border accent (`border-l-2 border-amber-500 pl-4`)
- No icon halos
- Prose unchanged

## Implementation Notes

- Tailwind v4 uses `@theme` and CSS custom properties — define the full token set in `src/app.css` under `@theme`
- Dark mode: use `prefers-color-scheme` media query on `:root`, not a class-based toggle (no JS required)
- `rounded-xl` and `rounded-2xl` are removed from the codebase; grep and replace
- `bg-zinc-*` classes are replaced with `bg-stone-*` or the custom charcoal variable
- `sky-500`/`sky-600`/`sky-700` as accent → `amber-500`/`amber-600`/`amber-400` (note: sky stays for "reported" status colour)
- All `uppercase tracking-[0.18em]` patterns → `font-semibold` with no tracking override

## Out of Scope

- Map tile style (Leaflet default tiles unchanged)
- Leaflet marker/cluster styles (addressed separately if needed)
- Admin UI (separate surface, not public-facing)
- OG image templates (can be updated in a follow-on)
- Any functional changes — this is visual only
