# Code Review: Public API Security Review
**Date:** 2026-02-22
**Reviewer:** GitHub Copilot (Security Mode)
**Component:** All public-facing API routes + supporting utilities
**Ready for Production:** Conditional — no blockers, but four medium-severity issues should be addressed before a high-traffic launch
**Critical Issues:** 0 🔴 | Medium Issues: 4 🟡 | Low Issues: 5 🟢

---

## Scope

Files reviewed:

1. `src/routes/api/report/+server.ts` — public report submission
2. `src/routes/api/admin/pothole/[id]/+server.ts` — admin delete (token-gated)
3. `src/routes/api/wanksy/+server.ts` — status transition: reported → wanksyd
4. `src/routes/api/filled/+server.ts` — status transition: wanksyd → filled
5. `src/lib/geo.ts` — geofence and point-in-ring utilities
6. `src/hooks.server.ts` — rate limiting and security headers (supporting context)
7. `src/routes/+page.svelte` (partial) — Leaflet popup XSS surface
8. `src/routes/hole/[id]/+page.svelte` (partial) — description rendering surface
9. `src/routes/api/feed.json/+server.ts` — public feed endpoint

---

## Priority 1 — Must Fix 🟡

### M-01: Wanksy and Filled transitions have no IP deduplication or per-action rate-limiting

**File:** `src/routes/api/wanksy/+server.ts`, `src/routes/api/filled/+server.ts`
**Risk:** Data integrity — any anonymous user can cycle through all live potholes and mark them `wanksyd` or `filled` within the global 10 req/min window.

The `report` endpoint has robust IP-hash deduplication per pothole. The `wanksy` and `filled` endpoints do not. The only guard is the status-condition in the `.eq('status', ...)` Supabase filter. This enforces valid state transitions but does nothing to restrict *who* can trigger them.

**Attack scenario:** An automated script rotates through all UUIDs from the public JSON feed, sends a `POST /api/wanksy` for each, and falsely promotes every reported pothole to `wanksyd` — or worse, uses `/api/filled` to mark them all as fixed when they are not.

**Recommended fix:** Record an `ip_hash` confirmation for each transition, just as the report endpoint does. Create a `pothole_actions` table (or reuse `pothole_confirmations` with an `action` column) and enforce `UNIQUE(pothole_id, ip_hash, action)` at the DB level.

```typescript
// Minimum viable guard for wanksy endpoint
const ip = getClientAddress();
const ipHash = await hashIp(ip); // extract the hash helper from report endpoint

const { data: alreadyActed } = await supabase
  .from('pothole_confirmations')
  .select('id')
  .eq('pothole_id', parsed.data.id)
  .eq('ip_hash', ipHash)
  .maybeSingle();

if (alreadyActed) {
  return json({ ok: false, message: 'Already actioned by this device.' });
}
```

---

### M-02: Non-atomic `confirmed_count` increment — race condition

**File:** `src/routes/api/report/+server.ts` (lines ~96–107)
**Risk:** Under concurrent load, two requests for the same pothole can both read the same `confirmed_count`, compute identical `newCount` values, and both write back the same number. The count undershoots by 1 or more, and a pothole that should go live may stay `pending`.

```typescript
// Current — not safe under concurrency
const newCount = match.confirmed_count + 1;
const newStatus = newCount >= CONFIRMATIONS_REQUIRED ? 'reported' : 'pending';
await supabase.from('potholes').update({ confirmed_count: newCount, status: newStatus }).eq('id', match.id);
```

**Recommended fix:** Use a Postgres atomic increment via a Supabase RPC (database function) so the read-modify-write is a single statement. Example migration:

```sql
CREATE OR REPLACE FUNCTION increment_confirmation(p_id uuid)
RETURNS TABLE(new_count int, new_status text) AS $$
DECLARE
  v_count int;
  v_status text;
BEGIN
  UPDATE potholes
  SET confirmed_count = confirmed_count + 1,
      status = CASE WHEN confirmed_count + 1 >= 3 THEN 'reported' ELSE status END
  WHERE id = p_id
  RETURNING confirmed_count, status INTO v_count, v_status;
  RETURN QUERY SELECT v_count, v_status;
END;
$$ LANGUAGE plpgsql;
```

```typescript
const { data } = await supabase.rpc('increment_confirmation', { p_id: match.id });
```

---

### M-03: In-memory rate limiter is ephemeral on serverless deployments

**File:** `src/hooks.server.ts`
**Risk:** On Netlify (serverless), each function invocation may run in an isolated context or a fresh cold start. The `rateLimitStore` Map resets on every cold start, making the 10 req/min limit unreliable. A high-volume attacker can intentionally trigger cold starts or simply rely on natural churn to bypass the limit.

The code already documents this caveat in a comment — but it is not classified alongside the other security notes, and there is no fallback.

**Recommended fix (in order of preference):**

1. **Use a Redis/KV store** (e.g., Upstash Redis via `@upstash/ratelimit`) — provides persistent, distributed rate limiting that survives cold starts and scales across function instances.
2. **Use Netlify's CDN-layer rate limiting** — configure via `netlify.toml` with `[[redirects]]` or Netlify WAF rules for `/api/*` paths.
3. **Short-term mitigation:** Move to Supabase as the rate-limit store: a `rate_limit_log(ip_hash, window_start, count)` table with an upsert. Slower than Redis but persistent.

---

### M-04: `confirmed_count` duplicate confirmation insert is not error-handled — silent integrity failure

**File:** `src/routes/api/report/+server.ts` (lines ~89–95)
**Risk:** The DB schema has `UNIQUE(pothole_id, ip_hash)` on `pothole_confirmations`. If two requests from the same IP arrive simultaneously and both pass the "already confirmed?" check (before either insert completes), the second insert will throw a unique-constraint violation that is silently swallowed. The `confirmed_count` will then be over-incremented by the update that follows.

```typescript
// No error handling on this insert
await supabase.from('pothole_confirmations').insert({ pothole_id: match.id, ip_hash: ipHash });
// Then blindly increments count...
const newCount = match.confirmed_count + 1;
```

**Recommended fix:** Check the result of the confirmation insert before proceeding:

```typescript
const { error: confirmError } = await supabase
  .from('pothole_confirmations')
  .insert({ pothole_id: match.id, ip_hash: ipHash });

if (confirmError) {
  // Unique constraint violation — duplicate submission
  if (confirmError.code === '23505') {
    return json({ id: match.id, confirmed: false, message: "You've already reported this one." });
  }
  throw error(500, 'Failed to record confirmation');
}
```

Combine this with fix M-02 (atomic increment RPC) for a fully safe flow.

---

## Priority 2 — Recommended 🟢

### L-01: Non-constant-time string comparison for admin token

**File:** `src/routes/api/admin/pothole/[id]/+server.ts`
**Risk:** Low. JavaScript's `!==` is not timing-safe. In theory, a sufficiently precise timing oracle could narrow down the secret byte-by-byte. In practice, over HTTPS with network jitter, this is not exploitable. Still a code hygiene issue.

```typescript
// Current
if (!auth || auth !== `Bearer ${ADMIN_SECRET}`) { ... }

// Safer
import { timingSafeEqual } from 'crypto'; // Node built-in

const expected = Buffer.from(`Bearer ${ADMIN_SECRET}`);
const provided = Buffer.from(auth ?? '');
const safe = expected.length === provided.length && timingSafeEqual(expected, provided);
if (!safe) throw error(401, 'Unauthorized');
```

---

### L-02: Admin DELETE response echoes the deleted UUID

**File:** `src/routes/api/admin/pothole/[id]/+server.ts`
**Risk:** Low. `return json({ ok: true, deleted: id })` confirms the UUID of the deleted record to the caller. Since the caller is already authenticated and supplied the ID, this is not a leak — but it is unnecessary information surface. `{ ok: true }` is sufficient.

---

### L-03: Admin route uses the anon Supabase key, not a service role key

**File:** `src/routes/api/admin/pothole/[id]/+server.ts`
**Risk:** Low. The Supabase client is constructed with `PUBLIC_SUPABASE_ANON_KEY`. Admin delete operations succeed only because RLS policies permit `DELETE` for the anon role, or RLS is not restrictive for that path. Using the anon key for server-side admin mutations violates the principle of least privilege and creates a hidden dependency on permissive RLS policies. If RLS is ever tightened (correctly), admin operations will silently fail.

**Recommended fix:** Import a `SUPABASE_SERVICE_ROLE_KEY` from `$env/static/private` and construct a separate server-only client for admin routes:

```typescript
import { ADMIN_SECRET, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

This key must never be used in client-side code and must stay in `$env/static/private`.

---

### L-04: `address` and `description` stored as raw user input — no server-side sanitization

**File:** `src/routes/api/report/+server.ts`
**Risk:** Low. The only server-side processing is `.trim()`. HTML entities (`<script>`, `"`, etc.) are persisted to the database as-is. This is mitigated in two places in the rendering layer:

- **Map popups:** `escapeHtml()` is correctly applied in `+page.svelte` before `bindPopup()`
- **Detail page:** Svelte template interpolation (`{pothole.description}`) auto-escapes

However, the `feed.json` endpoint returns raw `description` and `address` values to any consumer. A third-party consumer of the feed who renders those fields as HTML without escaping would be vulnerable.

**Recommended fix:** Sanitize at the API boundary before persistence, not (only) at render time. A simple HTML-entity encoder is sufficient since rich text is not needed:

```typescript
function stripHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c)
  );
}

// In the insert:
description: description ? stripHtml(description.trim()) : null,
address: address ? stripHtml(address.trim()) : null,
```

---

### L-05: `wards.geojson` server-cache is process-local and unbounded

**File:** `src/routes/api/wards.geojson/+server.ts`
**Risk:** Low / operational. The `let cached: unknown = null` module-level variable is process-local. On serverless, this provides no reuse guarantee. On a long-running process it could grow stale indefinitely (no TTL). Stale ward boundaries would silently give incorrect heatmap results.

**Recommended fix:** Add a TTL to the cache:

```typescript
let cached: { data: unknown; expiresAt: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In handler:
if (cached && Date.now() < cached.expiresAt) {
  return json(cached.data, { headers: { 'Cache-Control': 'public, max-age=86400' } });
}
// ... fetch ...
cached = { data: { type: 'FeatureCollection', features }, expiresAt: Date.now() + CACHE_TTL_MS };
```

---

## Confirmed Clean ✅

The following checks passed with no issues found:

| Check | Result |
|---|---|
| Supabase queries parameterized (no SQL interpolation) | ✅ All queries use the Supabase query builder with typed parameters |
| Raw IP stored or returned | ✅ SHA-256 hash only; raw IP never persisted, logged, or returned |
| Geofence bypass via type coercion | ✅ Zod schema enforces `z.number().finite().min().max()` before geofence runs |
| XSS in map popups | ✅ `escapeHtml()` applied to `address` and `description` before `bindPopup()` |
| XSS in detail page | ✅ Svelte template auto-escaping — `{pothole.description}` is safe |
| Error responses leak stack traces or Supabase detail | ✅ Generic messages only (`'Failed to update status'` etc.) |
| Admin token present on all admin operations | ✅ Present on the only existing handler (DELETE) |
| Zod schemas use strict parsing (no `.passthrough()`) | ✅ All schemas use `.safeParse()` without `.passthrough()` |
| `description` rendered via `@html` in Svelte | ✅ No `@html` directives found for user content |
| Admin PATCH endpoint exists without auth | ✅ No PATCH handler exists (CLAUDE.md mentions it — not yet implemented) |
| `geo.ts` injection surface | ✅ Pure math; no external I/O; only called with Zod-validated coordinates |
| Security headers set | ✅ `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `CSP`, `Permissions-Policy` |
| `feed.json` exposes `ip_hash` | ✅ Not in the `select()` column list |

---

## Summary Table

| ID | Severity | File | Issue |
|---|---|---|---|
| M-01 | 🟡 Medium | `wanksy/`, `filled/` | No IP deduplication on status transitions — mass false-flagging possible |
| M-02 | 🟡 Medium | `report/` | Non-atomic `confirmed_count` increment — race condition under concurrency |
| M-03 | 🟡 Medium | `hooks.server.ts` | In-memory rate limit resets on serverless cold starts |
| M-04 | 🟡 Medium | `report/` | Silent swallow of duplicate confirmation insert — integrity failure |
| L-01 | 🟢 Low | `admin/…/+server.ts` | Non-constant-time admin token comparison |
| L-02 | 🟢 Low | `admin/…/+server.ts` | DELETE response unnecessarily echoes deleted UUID |
| L-03 | 🟢 Low | `admin/…/+server.ts` | Anon key used for admin mutations — should use service role key |
| L-04 | 🟢 Low | `report/` | User input not sanitized at API layer (mitigated by render layer) |
| L-05 | 🟢 Low | `wards.geojson/` | Process-local ward cache has no TTL — stale after cold start restart |

---

## Recommended Action Order

1. **Fix M-04 first** — it's the simplest fix and directly hardens an existing integrity gap (handle the unique-constraint error on confirmation insert).
2. **Fix M-01** — add IP dedup to `wanksy` and `filled` endpoints. This is the most exploitable issue for data poisoning.
3. **Fix M-02** — introduce the `increment_confirmation` RPC to make confirmation counting atomic.
4. **Fix M-03** — replace in-memory rate limiting with a persistent store (Upstash Redis recommended given the Netlify deployment target).
5. **Address L-03** — add `SUPABASE_SERVICE_ROLE_KEY` to `.env.example` and use it in the admin client. Update `schema.sql` / RLS notes if policies are tightened as a result.
6. L-01, L-02, L-04, L-05 are housekeeping and can be batched.

---

*Manual review and testing with Accessibility Insights, OWASP ZAP, or equivalent are still recommended. This review is based on static analysis only.*
