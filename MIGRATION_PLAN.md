# Hosting Migration Plan

## Overview
Current status: The live instance is running as a macOS LaunchAgent (`ca.fillthehole.dev`). We need to migrate to a cloud host.
**Constraint:** Vercel's free tier has limitations with private repositories (specifically for Organizations).

## Alternative Options

### Option A: Netlify (Recommended)
- **Pros:** Generous free tier for private repos, native SvelteKit adapter, Edge Functions.
- **Cons:** Cold start times can vary.
- **Action:** Switch adapter to `@sveltejs/adapter-netlify`.

### Option B: Cloudflare Pages
- **Pros:** Excellent global performance, free private repos, very fast.
- **Cons:** Node.js compatibility (runtime is `workerd`, not Node). Some packages might break if they rely on specific Node APIs.
- **Action:** Switch adapter to `@sveltejs/adapter-cloudflare`.

### Option C: Self-Hosted (VPS)
- **Pros:** Total control, cheap ($5/mo), runs exactly like the current local setup (Node adapter).
- **Cons:** Maintenance overhead (OS updates, security, Nginx config).
- **Action:** Use `@sveltejs/adapter-node` and deploy via Docker or PM2.

## Selected Path: Netlify (for ease of migration)

## 1. Prerequisites
- [ ] **Netlify Account:** Sign up (free tier).
- [ ] **GitHub Connection:** Grant Netlify access to the repo.

## 2. Configuration Changes
1.  Uninstall Vercel adapter:
    ```bash
    npm uninstall @sveltejs/adapter-vercel
    ```
2.  Install Netlify adapter:
    ```bash
    npm install -D @sveltejs/adapter-netlify
    ```
3.  Update `svelte.config.js`:
    ```javascript
    import adapter from '@sveltejs/adapter-netlify';
    
    export default {
      kit: {
        adapter: adapter()
      }
    };
    ```

## 3. Environment Variables
Transfer these to **Netlify Site Settings > Build & Deploy > Environment**:

| Variable | Type |
|----------|------|
| `PUBLIC_SUPABASE_URL` | Public |
| `PUBLIC_SUPABASE_ANON_KEY` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret |
| `SIGHTENGINE_API_USER` | Secret |
| `SIGHTENGINE_API_SECRET` | Secret |

## 4. Deployment
1.  **New Site from Git:** Select the repo in Netlify dashboard.
2.  **Build Command:** `npm run build`
3.  **Publish Directory:** `build` (Netlify adapter default)

## 5. Troubleshooting: "Secrets scanning found leaked values"
If your build fails with a "Secrets scanning found leaked values" error pointing to `PUBLIC_SUPABASE_ANON_KEY`, this is expected behavior for SvelteKit. The key is *intended* to be public in the client bundle, but Netlify's scanner flags it.

**Solution:**
1.  Go to **Site settings > Build & deploy > Environment**.
2.  Add a new variable:
    *   **Key:** `SECRETS_SCAN_OMIT_KEYS`
    *   **Value:** `PUBLIC_SUPABASE_ANON_KEY`
3.  Redeploy.

## 6. DNS & Domains
1.  Add `fillthehole.ca` to Netlify Custom Domains.
2.  Update DNS (Netlify will provide nameservers or A/CNAME records).

