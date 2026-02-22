# Roadmap 2026

## Phase 1: Visual Proof (Photos)
*Objective: Increase report credibility and social sharability.*

- [ ] **Photo Uploads:** Allow users to attach a photo when reporting or flagging.
  - [ ] Supabase Storage bucket configuration (`pothole-photos`).
  - [ ] Frontend upload component with client-side compression/resizing.
  - [ ] Integration with SightEngine for automated nudity/violence detection.
  - [ ] Admin queue for manual review of flagged images.
- [ ] **Gallery View:** Show photos in the pothole detail popup and page.

## Phase 2: Engagement & Retention
*Objective: Keep users coming back without requiring accounts.*

- [ ] **"My Watchlist":** LocalStorage-based tracking of specific potholes.
  - [ ] "Watch this hole" button.
  - [ ] Homepage section showing status updates for watched holes.
- [ ] **Dynamic Social Cards:** Generate Open Graph images for pothole detail pages.
  - [ ] Show map snippet, status emoji, and address on the preview image.
- [ ] **Share Button:** Native share API integration for mobile users.

## Phase 3: Data Openness
*Objective: Empower data activists and local journalists.*

- [ ] **Open Data Export:** `/api/export.csv` endpoint for downloading dataset.
- [ ] **RSS Feed:** Feed of newly confirmed potholes and Filled celebrations.
- [ ] **Stats Dashboard Enhancements:**
  - [ ] "Time to Fill" charts.
  - [ ] Historical trends (month-over-month).

## Phase 4: Platform Stability
*Objective: Ensure long-term maintainability.*

- [ ] **Error Tracking:** Integrate Sentry or similar for client/server error monitoring.
- [ ] **Automated Backups:** Document and verify database backup strategy.
- [ ] **Admin Dashboard:** Simple protected route for managing reports/photos (currently partial).

## Future Ideas (Backlog)
- **Twitter/Bluesky Bot:** Auto-post significant events (new confirmed hole, hole filled).
- **Multi-Region Support:** Abstract geofencing and ward data to support other cities.
