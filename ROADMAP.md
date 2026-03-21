# Roadmap 2026

## Phase 1: Visual Proof (Photos) ✅ Shipped

_Objective: Increase report credibility and social sharability._

- [x] **Photo Uploads:** Allow users to attach a photo when reporting or flagging.
  - [x] Supabase Storage bucket configuration (`pothole-photos`).
  - [x] Frontend upload component with client-side compression/resizing.
  - [x] Integration with SightEngine for automated nudity/violence detection.
  - [x] Admin queue for manual review of flagged images.
  - [x] `deferred` status when SightEngine is unavailable — mandatory admin review, no silent pass-through.
- [x] **Gallery View:** Show approved photos on the pothole detail page.

## Phase 2: Engagement & Retention ✅ Shipped

_Objective: Keep users coming back without requiring accounts._

- [x] **"My Watchlist":** LocalStorage-based tracking of specific potholes.
  - [x] "Watch this hole" button.
  - [x] Homepage section showing status updates for watched holes.
- [x] **Dynamic Social Cards:** Open Graph images for pothole detail pages.
  - [x] Map snippet, status emoji, and address on the preview image.
- [x] **Share Buttons:** Social sharing for Reddit, Facebook, Bluesky, Threads, LinkedIn.
  - [x] Native Web Share API for mobile users.
  - [x] Copy-link button with clipboard API.
  - [x] Footer share links + dedicated "Spread the word" section on About page.
  - [x] Road safety reminder on About page.

## Phase 3: Data Openness ✅ Shipped

_Objective: Empower data activists and local journalists._

- [x] **Open Data Feed:** `/api/feed.json` endpoint of recent confirmed potholes.
- [x] **Stats Dashboard:** Resolution time, ward leaderboards, hotspot streets, fill rate trends.
- [x] **Open Data Export:** `/api/export.csv` for full dataset download.
- [x] **RSS/Atom Feed:** `/api/feed.xml` — RSS 2.0 feed of recent confirmations and fills.

## Phase 4: Admin & Moderation ✅ Shipped

_Objective: Maintain data quality and security._

- [x] **Admin Dashboard:** Session-based auth (email + password + TOTP MFA), pothole and photo moderation queues, watchlist, site settings.
- [x] **Photo Publishing Toggle:** `photos_published` flag — admin must explicitly publish photos per pothole before public display.
- [x] **Configurable Confirmation Threshold:** `site_settings` table, adjustable without code changes.
- [x] **Pushover Notifications:** Real-time push alerts for photo uploads, pothole confirmations, fills, admin logins, and security events.
- [x] **Security Hardening:** Full audit sprint — rate limiting, MFA, CSRF nonce, CSP, state machine for status transitions, IP hashing, trusted device tokens.
- [x] **Key Rotation Runbook:** `docs/key-rotation.md` covering all secrets and rotation procedures.

## Phase 5: Platform Stability ✅ Shipped

_Objective: Ensure long-term maintainability._

- [x] **Error Tracking:** Sentry integrated via `@sentry/sveltekit` — captures server and client errors, disabled when `PUBLIC_SENTRY_DSN` is absent.
- [x] **Automated Backups:** `docs/backup-strategy.md` — covers Supabase automated backups, pg_dump procedure, Storage bucket backups, restore checklist, and monthly verification schedule.
- [x] **E2E Tests:** Playwright coverage across 11 spec files — report flow, map, navigation, geofence, stats, pothole detail, admin layout, API schema validation, open data endpoints, and security headers.

## Phase 6: Community & Reach (In Progress)

_Objective: Grow the community of reporters and make fixes more likely._

- [x] **Bluesky Bot:** Auto-post significant events (new confirmed pothole, hole filled) to a dedicated account (@fillthehole.bsky.social). Drives organic discovery and keeps engaged followers informed.
- [x] **Ward Accountability Grade:** Letter grade (A–F) per ward on the stats page — composite of fill rate (70%) and average response time (30%).
- [x] **"I Hit This" Signal:** Button on pothole detail pages for drivers to record a physical encounter. Hit count shown publicly; helps surface high-impact potholes.
- [x] **Repeat Pothole Detection:** Detail page warns when a nearby pothole was previously filled — flags recurring road issues for escalation.
- [x] **Embed Widget:** `/api/embed/[id]` returns a self-contained embeddable card (iframe-friendly) showing pothole status and a CTA link back to the site.
- [x] **PWA + Push Notifications:** Web App Manifest, service worker, and browser push notification infrastructure. Users can subscribe to fill alerts; requires `VAPID_PUBLIC_KEY` + `PUBLIC_VAPID_PUBLIC_KEY` env vars.
