-- schema_review_fixes.sql — Code and security review fixes (2026-03-25)
-- Run BEFORE deploying the corresponding code changes.

-- ---------------------------------------------------------------------------
-- 1. Expand api_rate_limit_events scope constraint
--    New scopes added: 'hit_submit' (api/hit), 'push_subscribe' (api/subscribe)
-- ---------------------------------------------------------------------------
ALTER TABLE api_rate_limit_events
  DROP CONSTRAINT IF EXISTS api_rate_limit_events_scope_check;

ALTER TABLE api_rate_limit_events
  ADD CONSTRAINT api_rate_limit_events_scope_check
  CHECK (scope IN ('report_submit', 'photo_upload', 'hit_submit', 'push_subscribe'));

-- ---------------------------------------------------------------------------
-- 2. Drop public read policy on pothole_confirmations
--    Exposes ip_hash to the anon key. Sprint 3 already fixed pothole_actions
--    for the same reason (L6). Confirmation counts are surfaced only via
--    potholes.confirmed_count — no direct confirmation row reads are needed
--    by any anon-key path.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read confirmations" ON pothole_confirmations;
DROP POLICY IF EXISTS "Public insert confirmations" ON pothole_confirmations;

-- Re-create insert-only policy (still needed — report endpoint uses anon key
-- for the first pothole_confirmations insert via the anon client; this will be
-- migrated to service-role in the accompanying code change, but keep the
-- policy in place until the deploy completes).
-- NOTE: after deploying api/report/+server.ts changes, this INSERT policy
-- can also be dropped since all confirmation writes will use service-role.
CREATE POLICY "Public insert confirmations"
  ON pothole_confirmations FOR INSERT
  WITH CHECK (true);
