# Vercel Migration Plan

## Overview
Current status: The application code is configured for Vercel (`@sveltejs/adapter-vercel`), but the live instance is currently running as a macOS LaunchAgent (`ca.fillthehole.dev`).

This plan outlines the steps to migrate production hosting to Vercel.

## 1. Prerequisites
- [ ] **Vercel Account:** Ensure access to a Vercel team or pro account (recommended for commercial projects, though Hobby works for personal).
- [ ] **GitHub Connection:** Connect the repository `BreakableHoodie/filltheholedotca` to Vercel.

## 2. Configuration Check (Already Complete)
- `svelte.config.js` is already using `@sveltejs/adapter-vercel`.
- Runtime is set to `nodejs22.x`.
- `package.json` includes the adapter dependency.

## 3. Environment Variables
Transfer these values from your local `.env` (or the macOS LaunchAgent plist) to **Vercel Project Settings > Environment Variables**:

| Variable | Type | Notes |
|----------|------|-------|
| `PUBLIC_SUPABASE_URL` | Public | The Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Public | The `anon` key (safe for client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | **CRITICAL**: Used for admin API routes. Do NOT expose this to the client. |
| `SIGHTENGINE_API_USER` | Secret | Optional (for future image moderation) |
| `SIGHTENGINE_API_SECRET` | Secret | Optional (for future image moderation) |

**Action Item:** Manually add these in the Vercel dashboard before the first deployment.

## 4. Deployment Strategy
1.  **Connect Repo:** Import the project in Vercel.
2.  **Build Settings:**
    *   Framework Preset: SvelteKit (should auto-detect).
    *   Build Command: `npm run build` (default).
    *   Output Directory: `.svelte-kit/output` (handled by adapter).
3.  **Deploy:** Pushing to `main` will trigger the build.

## 5. DNS & Domains
1.  **Add Domain:** Add `fillthehole.ca` to Vercel Domains.
2.  **Update DNS:**
    *   Add `A` record `@` pointing to `76.76.21.21`.
    *   Add `CNAME` record `www` pointing to `cname.vercel-dns.com`.
3.  **Verify SSL:** Vercel will automatically provision certs.

## 6. Post-Migration Verification
- [ ] **Static Assets:** Verify map tiles and CSS load correctly.
- [ ] **API Routes:** Test `/api/report` (submit a test pothole).
- [ ] **Supabase Connectivity:** Ensure the Vercel serverless functions can reach Supabase (no firewall blocking Vercel IPs).
- [ ] **GeoJSON:** Verify `/api/wards.geojson` loads (it's a static asset served via API).

## 7. Decommissioning Old Host
Once Vercel is live and verified:
1.  Unload the macOS LaunchAgent:
    ```bash
    launchctl unload ~/Library/LaunchAgents/ca.fillthehole.dev.plist
    ```
2.  Update `README.md` to reflect Vercel as the primary host.
