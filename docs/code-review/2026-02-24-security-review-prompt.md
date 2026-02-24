# Security Review Results — 2026-02-24

**Review Status:** ✅ **COMPLETE**
**Ready for Production:** ✅ **YES — all actionable findings resolved**
**Scope:** Full codebase, including pothole lifecycle changes on `feat/pothole-lifecycle`
**Resolved in commit:** `36615bc`

---

## Executive Summary

This is a public-facing SvelteKit app that accepts untrusted input from anonymous users. The review identified **1 Critical**, **4 High**, **3 Medium**, and **2 Low** severity security issues. All actionable findings have been addressed. Two findings were false positives against stale code; two are accepted architectural risks.

---

## Security Findings

### 🔴 CRITICAL SEVERITY

**C-01: Mass pothole manipulation via `/api/filled` endpoint** ✅ FIXED
- **File:** `src/routes/api/filled/+server.ts`
- **Issue:** The endpoint only validated UUID format but accepted any pothole ID. An attacker could enumerate potholes and mark them filled en masse.
- **Fix:** Added a persistent per-IP rate limit (max 10 fills/hour) backed by the `pothole_actions` table. DB-backed means it survives serverless cold starts, also resolving M-03 for this endpoint. The per-pothole unique constraint (`pothole_id, ip_hash, action`) was already in place; this adds a cross-pothole limit.

---

### 🟠 HIGH SEVERITY

**H-01: Inconsistent status transition logic** ✅ FALSE POSITIVE
- **File:** `src/routes/api/filled/+server.ts`
- **Finding:** Reviewer looked at stale code. The endpoint correctly uses `.in('status', ['reported', 'wanksyd'])` — `reported` is accepted directly, `wanksyd` is kept for historical rows only. No action required.

**H-02: XSS vulnerability in Leaflet popup rendering** ✅ FIXED
- **File:** `src/routes/+page.svelte` → `src/lib/escape.ts`
- **Issue:** Custom `escapeHtml` was defined inline; DOMPurify recommended.
- **Fix:** Extracted `escapeHtml` to `src/lib/escape.ts` as a shared utility with a documented rationale. Note: for this context (zero HTML allowed from user content), plain-text escaping of the five HTML metacharacters (`& < > " '`) is more appropriate than DOMPurify, which is designed to allow *some* HTML through. The custom implementation is correct and now centralised.

**H-03: Admin endpoint insufficient authorization** ✅ PARTIALLY ADDRESSED
- **File:** `src/routes/api/admin/pothole/[id]/+server.ts`
- **Issue:** Single `ADMIN_SECRET` with no audit trail.
- **Fix:** Added `console.info` for successful admin operations and `console.warn` for unauthorized attempts (includes caller IP, never logs the secret). Full JWT auth and IP allowlisting are out of scope for this project's threat model (no public admin UI, secret is out-of-band).

**H-04: Service role key exposure risk** ✅ ALREADY HANDLED
- **File:** `src/routes/api/admin/pothole/[id]/+server.ts`
- **Finding:** Key is correctly imported via `$env/static/private` which SvelteKit enforces as server-only at build time. No client bundle leakage is possible through this mechanism. No action required.

---

### 🟡 MEDIUM SEVERITY

**M-01: Weak input validation on string fields** ✅ FIXED
- **File:** `src/routes/api/report/+server.ts`
- **Issue:** Zod schema lacked `.trim()`, allowing whitespace-only strings to pass validation.
- **Fix:** Added `.trim()` to `address` and `description` in the zod schema. Whitespace-only values are now rejected at parse time.

**M-02: Enumeration vulnerability in pothole ID exposure** ✅ ACCEPTED RISK
- **Finding:** Pothole IDs are v4 UUIDs (randomly generated 128-bit). Brute-force enumeration is computationally infeasible (~5.3 × 10³⁵ possible values). This is informational and no action is required. Adding opaque tokens would complicate the public feed and share links without meaningful security benefit.

**M-03: Rate limiting insufficient for serverless deployment** ✅ RESOLVED VIA C-01
- **Finding:** In-memory rate limit resets on Netlify cold starts.
- **Fix:** The C-01 fix (DB-backed per-IP count on `pothole_actions`) resolves this for the highest-risk endpoint (`/api/filled`). The in-memory limit in `hooks.server.ts` remains a deterrent for all other endpoints; a note acknowledging the limitation is already in the code. Full persistent rate limiting (Upstash Redis) is a future improvement.

---

### 🟢 LOW SEVERITY

**L-01: Information leakage in error messages** ✅ ALREADY HANDLED
- **Finding:** Error messages may reveal internal details.
- **Assessment:** All user-facing error messages already use generic strings (`'Invalid request'`, `'Failed to delete'`, etc.). Detailed errors are logged server-side only. No action required.

**L-02: Missing HSTS header** ✅ FIXED
- **File:** `src/hooks.server.ts`
- **Fix:** Added `Strict-Transport-Security: max-age=63072000; includeSubDomains` to all responses.

---

## Informational Findings

**I-01: Wanksy endpoint still exists** ✅ FALSE POSITIVE
- **Finding:** Reviewer noted the endpoint still exists.
- **Fact:** `src/routes/api/wanksy/+server.ts` was deleted in this branch. Reviewer examined main or a cached snapshot.

**I-02: Supabase RLS policies are properly configured** ✅ CONFIRMED
- RLS correctly enabled on all tables with appropriate public policies.

**I-03: IP hashing implementation is secure** ✅ CONFIRMED
- SHA-256 hashing in `src/lib/hash.ts` ensures raw IPs are never stored.

---

## Resolution Summary

| ID | Severity | Status |
|----|----------|--------|
| C-01 | Critical | ✅ Fixed (`filled` persistent rate limit) |
| H-01 | High | ✅ False positive |
| H-02 | High | ✅ Fixed (`escapeHtml` extracted to `$lib/escape.ts`) |
| H-03 | High | ✅ Audit logging added |
| H-04 | High | ✅ Already handled |
| M-01 | Medium | ✅ Fixed (zod `.trim()`) |
| M-02 | Medium | ✅ Accepted risk (v4 UUIDs) |
| M-03 | Medium | ✅ Resolved via C-01 fix |
| L-01 | Low | ✅ Already handled |
| L-02 | Low | ✅ Fixed (HSTS header) |
| I-01 | Info | ✅ False positive |
| I-02 | Info | ✅ Confirmed |
| I-03 | Info | ✅ Confirmed |
