-- schema_pothole_confirmations_ttl.sql
-- R26-L1 / PIPEDA data minimization: purge pothole_confirmations rows for
-- potholes that have been filled or expired for > 90 days. The confirmation
-- records exist only to enforce per-IP dedup; once a pothole is resolved and
-- past the retention window, keeping the ip_hash serves no operational purpose.
-- Runs nightly at 04:45 UTC (after hits/actions purge jobs at 04:15/04:30).

select cron.unschedule(jobid) from cron.job where jobname = 'purge-pothole-confirmations';
select cron.schedule(
    'purge-pothole-confirmations',
    '45 4 * * *',
    $$
        delete from pothole_confirmations
        where pothole_id in (
            select id from potholes
            where status in ('filled', 'expired')
            and coalesce(filled_at, expired_at) < now() - interval '90 days'
        );
    $$
);
