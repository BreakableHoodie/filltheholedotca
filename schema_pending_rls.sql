-- schema_pending_rls.sql — Close pending-pothole enumeration via the anon key (2026-06-11)
-- Run BEFORE (or together with) deploying the corresponding code change in
-- src/routes/hole/[id]/+page.server.ts.
--
-- Problem
-- -------
-- The original "Public read" policy on `potholes` was `using (true)`, so every
-- row — including `pending` potholes that have not yet reached the 2-confirmation
-- threshold — is readable by the public anon key. The application's own queries
-- filter pending rows with `.neq('status','pending')`, but Row Level Security is
-- the LAST line of defence: PostgREST honours RLS row predicates, not app-layer
-- query filters. Anyone holding the anon key can therefore enumerate every
-- unconfirmed report directly:
--
--     GET /rest/v1/potholes?status=eq.pending
--
-- That leaks single-reporter submissions (and their rounded-but-real locations)
-- that were never meant to be public until a second, distinct reporter confirms
-- them.
--
-- Fix
-- ---
-- Replace the blanket read policy with one that excludes `pending` rows. The two
-- legitimate readers of pending rows both run server-side with the service-role
-- key, which bypasses RLS, so neither is affected:
--   * /api/watchlist        — reporter self-tracking by UUID (getAdminClient)
--   * /hole/[id] SSR loader  — post-report view, switched to getAdminClient in
--                              the accompanying code change
-- The homepage map SSR load uses the anon client but already filters
-- `.neq('status','pending')`, so it is unaffected.
--
-- `status <> 'pending'` (rather than `status IS DISTINCT FROM 'pending'`) keeps
-- any row with a NULL status hidden, matching the map's existing `.neq` behaviour.

DROP POLICY IF EXISTS "Public read" ON potholes;

CREATE POLICY "Public read non-pending"
  ON potholes FOR SELECT
  USING (status <> 'pending');
