---
agent: agent
description: 'Security review of the public API routes for fillthehole.ca — injection, XSS, geofence bypass, admin auth, IP handling, and error leakage'
tools: ['codebase', 'edit/editFiles', 'search', 'problems']
mode: agent
---

Review the public API routes for this SvelteKit application.

**Project context:**
- Public civic app — no auth system. All writes are IP-deduplicated (SHA-256 hash). No accounts, no sessions.
- Stack: SvelteKit + TypeScript, Supabase (Postgres + RLS), Zod for validation
- Admin routes are protected by a secret token only
- Inputs accepted from anonymous public users: GPS coordinates, text descriptions, IP-derived hashes

**Files to review (in priority order):**
1. `src/routes/api/report/+server.ts` — highest risk. Accepts public reports, runs geofence check, IP dedup, and 50m merge logic
2. `src/routes/api/admin/pothole/[id]/+server.ts` — admin delete/patch. Token-gated
3. `src/routes/api/filled/+server.ts` — status transition: reported → filled
4. `src/lib/geo.ts` — geofence and point-in-ring utilities used by the above

**What to look for:**
- Injection: are all Supabase queries parameterized, or is any user input interpolated?
- XSS: the `description` field from user input is rendered in Leaflet `bindPopup()` calls — is it escaped before insertion into HTML?
- Geofence bypass: can lat/lng be coerced to pass the boundary check?
- Admin auth: is the token check resistant to timing attacks? Is it present on all admin operations?
- IP hash: is the raw IP ever logged, returned in a response, or stored before hashing?
- Error leakage: do error responses expose stack traces, internal IDs, or Supabase error details?
- Rate limiting: what prevents bulk submissions from a single IP beyond the existing dedup logic?
- Input validation: are Zod schemas strict (no `.passthrough()`)? Are coordinates validated as numbers within bounds before the geofence function runs?

**Business constraints:**
- Security-sensitive (treat as high risk — production, public-facing)
- No auth to hide behind — every endpoint is reachable by anyone
- RLS in Supabase is the last line of defence; the application layer must hold first

Save your findings to `docs/code-review/[today's date]-api-security-review.md`.
