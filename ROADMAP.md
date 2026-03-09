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

## Phase 3: Data Openness ✅ Partially Shipped

_Objective: Empower data activists and local journalists._

- [x] **Open Data Feed:** `/api/feed.json` endpoint of recent confirmed potholes.
- [x] **Stats Dashboard:** Resolution time, ward leaderboards, hotspot streets, fill rate trends.
- [ ] **Open Data Export:** `/api/export.csv` for full dataset download.
- [ ] **RSS/Atom Feed:** Newly confirmed potholes and fill events.

## Phase 4: Admin & Moderation ✅ Shipped

_Objective: Maintain data quality and security._

- [x] **Admin Dashboard:** Session-based auth (email + password + TOTP MFA), pothole and photo moderation queues, watchlist, site settings.
- [x] **Photo Publishing Toggle:** `photos_published` flag — admin must explicitly publish photos per pothole before public display.
- [x] **Configurable Confirmation Threshold:** `site_settings` table, adjustable without code changes.
- [x] **Pushover Notifications:** Real-time push alerts for photo uploads, pothole confirmations, fills, admin logins, and security events.
- [x] **Security Hardening:** Full audit sprint — rate limiting, MFA, CSRF nonce, CSP, state machine for status transitions, IP hashing, trusted device tokens.
- [x] **Key Rotation Runbook:** `docs/key-rotation.md` covering all secrets and rotation procedures.

## Phase 5: Platform Stability

_Objective: Ensure long-term maintainability._

- [ ] **Error Tracking:** Integrate Sentry or similar for client/server error monitoring.
- [ ] **Automated Backups:** Document and verify database backup strategy.
- [ ] **E2E Tests:** Playwright coverage for critical user journeys (report, confirm, photo upload).

## Future Ideas (Backlog)

- **Bluesky Bot:** Auto-post significant events (new confirmed pothole, hole filled).
- **Councillor Integration:** Auto-email the relevant ward councillor when a pothole goes live.
- **Multi-Region Support:** Abstract geofencing and ward data to support other cities.
