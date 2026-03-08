-- schema_sprint3.sql — Security hardening sprint 3
-- Run after all previous migration files.
-- Apply in Supabase SQL editor or via psql.

-- ---------------------------------------------------------------------------
-- L6: Drop public SELECT policy on pothole_actions.
-- The policy was needed by the filled endpoint's rate-limit check which used
-- the anon key. That endpoint now uses the service-role client (see
-- src/routes/api/filled/+server.ts), so public read access is no longer
-- required and was a data-leak vector (ip_hash correlation across actions).
-- ---------------------------------------------------------------------------
drop policy if exists "Public read actions" on pothole_actions;

-- ---------------------------------------------------------------------------
-- L1: Fix pg_cron expiry interval — the comment in schema.sql said 6 months
-- but the business rule is 90 days (CLAUDE.md, README). The scheduled job
-- must be re-created to pick up the corrected interval.
--
-- Run this only if the 'expire-old-potholes' job already exists.
-- If starting fresh, the correct interval is already in the cron.schedule
-- call below — skip the unschedule step.
-- ---------------------------------------------------------------------------
-- SELECT cron.unschedule('expire-old-potholes');

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'expire-old-potholes',
  '0 3 * * *',
  $$
    UPDATE potholes
    SET status = 'expired', expired_at = NOW()
    WHERE status = 'reported'
      AND created_at < NOW() - INTERVAL '90 days';
  $$
);

-- ---------------------------------------------------------------------------
-- L2: Expire stale pending potholes.
-- Pending potholes (1 report, never confirmed) were never expired, allowing a
-- merge-radius suppression attack: flood nearby coordinates with unconfirmed
-- reports so legitimate reports merge into them and never go live.
-- Expire pending potholes older than 14 days.
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'expire-stale-pending',
  '30 3 * * *',
  $$
    UPDATE potholes
    SET status = 'expired', expired_at = NOW()
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '14 days';
  $$
);

-- Backfill: expire any already-stale pending potholes immediately.
UPDATE potholes
SET status = 'expired', expired_at = NOW()
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '14 days';
