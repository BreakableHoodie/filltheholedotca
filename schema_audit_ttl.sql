-- schema_audit_ttl.sql
-- PIPEDA data minimization: add pg_cron purge jobs for admin audit tables.
-- These tables have no automatic retention policy and accumulate indefinitely.
--
-- Retention periods chosen to balance operational needs with PIPEDA minimization:
--   admin_auth_attempts  — 90 days  (security telemetry; same as api_rate_limit_events)
--   admin_audit_log      — 24 months (minimum window for breach investigation evidence)
--
-- Unschedule by jobid first (safe no-op if job doesn't exist) so the migration
-- is idempotent across pg_cron versions that lack the text overload.

select cron.unschedule(jobid) from cron.job where jobname = 'purge-admin-auth-attempts';
select cron.schedule(
    'purge-admin-auth-attempts',
    '0 5 * * *',
    $$
        delete from admin_auth_attempts
        where created_at < now() - interval '90 days';
    $$
);

select cron.unschedule(jobid) from cron.job where jobname = 'purge-admin-audit-log';
select cron.schedule(
    'purge-admin-audit-log',
    '30 5 * * *',
    $$
        delete from admin_audit_log
        where created_at < now() - interval '24 months';
    $$
);
