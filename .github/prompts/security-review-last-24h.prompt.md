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
- Public endpoints are anonymous; admin endpoints are privileged
- Security policy focus includes injection, XSS, authz bypass, data exposure, and geofence/rate-limit bypass

## Input preparation

Before reviewing findings, derive the review window from current repo state:

- Gather commits in the last 24 hours (`git log --since='24 hours ago' --oneline --no-merges`)
- Gather changed files in the same window (`git log --since='24 hours ago' --name-only --pretty=format:`)
- Prioritize files that are both changed and security-sensitive
- If there are no commits in the last 24 hours, state that clearly and review the latest security-relevant commits instead

## Priority areas (if touched)

- `src/routes/api/**/+server.ts`
- `src/hooks.server.ts`
- `src/routes/**/*.server.ts`
- `src/lib/{escape,hash,types,geo}.ts`
- `.github/workflows/{ci,codeql,dependency-review}.yml`
- `SECURITY.md`, `README.md`, `.env.example`, `schema*.sql`

## What to verify

- Authentication and authorization on privileged routes (all methods consistently enforced, no bypass paths, constant-time secret comparison if applicable)
- Input validation and canonicalization on all public write endpoints
- Upload safety controls (file type validation, size limits, filename/path safety, untrusted metadata handling, storage permissions)
- Geofence and anti-abuse controls (bypass opportunities, float coercion edge cases, replay/spam paths)
- IP/privacy handling (`x-forwarded-for` trust model, raw IP leakage in logs/errors/responses, hash usage consistency)
- Injection risks (unsafe string interpolation into queries, unsafe command/path usage, untrusted data into dangerous sinks)
- XSS and output encoding (especially HTML/popup rendering paths and escaping helper usage)
- Error leakage (stack traces, internal IDs, backend error details)
- HTTP/caching/security headers behavior (sensitive responses cached publicly, missing protections in hooks or route handlers)
- Dependency and CI security posture changes (dependency-review/code scanning workflow gaps)

## Required output

Create `docs/code-review/YYYY-MM-DD-security-review-last-24h.md` (using today's date for `YYYY-MM-DD`) with:

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
