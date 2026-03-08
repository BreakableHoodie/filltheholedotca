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
-- but the business rule is 90 days (CLAUDE.md, README).
-- L2: Add expire-stale-pending job — pending potholes (1 unconfirmed report)
-- were never expired, enabling a merge-radius suppression attack.
--
-- Both SELECT cron.unschedule(...) calls are safe to run unconditionally:
-- if the job doesn't exist the WHERE EXISTS returns no rows and nothing is
-- unscheduled; if it does exist it is removed before being re-created.
-- This makes the entire script idempotent.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if present (idempotent)
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'expire-old-potholes';

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

-- Remove existing job if present (idempotent)
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'expire-stale-pending';

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
