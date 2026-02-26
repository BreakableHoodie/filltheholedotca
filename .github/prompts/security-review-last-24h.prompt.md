---
agent: agent
description: 'Security review of the last 24h code changes in fillthehole.ca, with evidence-backed findings and concrete fixes'
tools: ['codebase', 'search', 'problems']
mode: agent
---

Perform a focused security review of code changed in the last 12-24 hours, then do a light sweep for related regressions.

## Scope and context

- Project: `filltheholedotca` (public civic reporting app)
- Stack: SvelteKit + TypeScript, Supabase (Postgres + RLS), Zod
- Public endpoints are anonymous; admin endpoints are token-protected
- Security policy focus includes injection, XSS, authz bypass, data exposure, and geofence/rate-limit bypass

## Change window to review (Feb 25, 2026)

- `af5a302` (2026-02-25 20:23 -0500) Fix photo upload error handling and expand .gitignore
- `249f8fe` (2026-02-25 19:39 -0500) Fix photo upload error handling from PR review
- `924825b` (2026-02-25 19:21 -0500) Harden upload/report security and remove OG external dependencies
- `dd84890` (2026-02-25 13:18 -0500) CI: add E2E tests and dependency review workflows

## Priority files (changed in this window)

- `src/routes/api/report/+server.ts`
- `src/routes/api/photos/+server.ts`
- `src/routes/api/filled/+server.ts`
- `src/routes/api/admin/photo/[id]/+server.ts`
- `src/routes/api/admin/pothole/[id]/+server.ts`
- `src/routes/api/og/[id]/+server.ts`
- `src/routes/api/feed.json/+server.ts`
- `src/routes/api/wards.geojson/+server.ts`
- `src/routes/+page.server.ts`
- `src/routes/hole/[id]/+page.server.ts`
- `src/hooks.server.ts`
- `src/lib/escape.ts`
- `src/lib/hash.ts`
- `src/lib/types.ts`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/ci.yml`
- `SECURITY.md`

## What to verify

- Authentication and authorization on admin routes (all methods consistently enforced, no bypass paths, constant-time token comparison if applicable)
- Input validation and canonicalization on all public write endpoints (`report`, `photos`, `filled`)
- Upload safety controls (file type validation, size limits, filename/path safety, untrusted metadata handling, storage permissions)
- Geofence and anti-abuse controls (bypass opportunities, float coercion edge cases, replay/spam paths)
- IP/privacy handling (`x-forwarded-for` trust model, raw IP leakage in logs/errors/responses, hash usage consistency)
- Injection risks (unsafe string interpolation into queries, unsafe command/path usage, untrusted data into dangerous sinks)
- XSS and output encoding (especially any HTML/popup rendering paths and escaping helper usage)
- Error leakage (stack traces, internal IDs, backend error details)
- HTTP/caching/security headers behavior (sensitive responses cached publicly, missing protections in hooks or route handlers)
- Dependency and CI security posture changes (dependency-review/code scanning workflow gaps)

## Required output

Create `docs/code-review/2026-02-26-security-review-last-24h.md` with:

1. Executive summary (2-4 bullets)
2. Findings by severity: Critical, High, Medium, Low
3. For each finding include:
   - Rule ID
   - Severity
   - Location (file + line numbers)
   - Evidence (code snippet)
   - Impact
   - Exploit path (how an attacker would trigger it)
   - Minimal fix recommendation
4. A "No finding" section for controls reviewed and found acceptable
5. A short "Suggested tests to add" section (security regression tests only)

## Review quality bar

- Evidence-based findings only; do not report speculative issues without code evidence.
- Prefer diff-aware review first (what changed), then related-call-site checks to catch regressions.
- Treat missing context explicitly (for example, "needs runtime verification at edge/proxy").

