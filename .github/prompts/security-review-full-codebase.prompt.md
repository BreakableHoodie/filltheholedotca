---
agent: agent
description: 'Full codebase security review for fillthehole.ca with evidence-based findings, exploit paths, and concrete fixes'
tools: ['codebase', 'search', 'problems']
mode: agent
---

Perform a full security review of this repository (not diff-focused). Prioritize high-impact attack paths first, then cover the remaining surface area.

## Project context

- Project: `filltheholedotca` (public civic reporting app)
- Stack: SvelteKit + TypeScript, Supabase (Postgres + RLS), Zod, Playwright
- Threat model: anonymous internet users can call public endpoints directly; admin operations are privileged
- Security policy focus includes injection, XSS, auth/authz bypass, data exposure, and geofence/rate-limit bypass

## Scope

Review the entire codebase, with priority on:

- `src/routes/api/**/+server.ts`
- `src/hooks.server.ts`
- `src/lib/**/*.ts`
- `src/routes/**/*.server.ts`
- SQL schema and migration files (`schema*.sql`)
- CI and security workflows (`.github/workflows/*.yml`)
- Security/process docs that influence implementation (`SECURITY.md`, `README.md`, `.env.example`)

Then perform a secondary pass over frontend rendering paths for stored/reflected XSS and unsafe output handling.

## Security checks required

- Authentication/authorization correctness across all privileged routes and operations
- Input validation and canonicalization (types, bounds, strict schemas, unknown field handling)
- Injection risks (SQL/query construction, command/path injection, template/context injection)
- XSS and output encoding (HTML sinks, map popups, user-generated content rendering)
- CSRF/CORS and cross-origin trust assumptions where applicable
- Upload/file handling controls (type, size, path safety, content handling, storage permissions)
- Geofence, abuse prevention, and replay/spam bypass opportunities
- IP/privacy handling (`x-forwarded-for` trust, raw IP exposure, hash usage consistency)
- Error handling and information disclosure (stack traces, internals, sensitive identifiers)
- Security headers/cache behavior for dynamic or sensitive responses
- Dependency and supply-chain controls (lockfile hygiene, dependency review, code scanning coverage)
- Secrets management and environment boundary mistakes (server-only vs client-exposed variables)

## Required output

Create `docs/code-review/YYYY-MM-DD-security-review-full-codebase.md` (using today's date for `YYYY-MM-DD`) with:

1. Executive summary (2-6 bullets)
2. Attack surface map (entry points, trust boundaries, sensitive data flows)
3. Findings by severity: Critical, High, Medium, Low
4. For each finding include:
   - Rule ID
   - Severity
   - Location (file + line numbers)
   - Evidence (code snippet)
   - Impact
   - Exploit path (step-by-step attacker path)
   - Minimal fix recommendation
   - Defense-in-depth recommendation
5. "No finding" controls reviewed and judged acceptable
6. "Security test gaps" with concrete regression tests to add
7. "Top 5 fixes to implement first" prioritized by risk reduction vs effort

## Review quality bar

- Evidence-based findings only; no speculative issues without code evidence.
- If a control may exist outside the repo (edge/proxy/hosting), label it as "runtime verification required".
- Prefer practical exploitability over theoretical concerns.
- Avoid noisy low-impact lint-style comments unless they create a meaningful security risk.
