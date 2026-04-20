-- schema_rate_limit_cleanup.sql
-- PRIV-2: PIPEDA data minimization — add pg_cron purge job for api_rate_limit_events.
-- Rate limit events are operational telemetry, not records of activity; retaining them
-- indefinitely serves no purpose and creates unnecessary risk if the table is ever accessed.

-- Purge api_rate_limit_events older than 90 days.
-- Runs nightly at 04:00 UTC alongside the existing expiry jobs.
-- Unschedule first so the migration is safe to re-apply (idempotent).
select cron.unschedule('purge-rate-limit-events');
select cron.schedule(
    'purge-rate-limit-events',
    '0 4 * * *',
    $$
        delete from api_rate_limit_events
        where created_at < now() - interval '90 days';
    $$
);
