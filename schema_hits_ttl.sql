-- schema_hits_ttl.sql
-- R26-C2 / PIPEDA data minimization: add pg_cron purge jobs for pothole_hits
-- and pothole_actions. Both tables store ip_hash indefinitely; 90-day retention
-- matches the rate_limit_events window and covers all active reporting cycles.

-- pothole_hits: purge rows older than 90 days.
-- Hit signals are used for prioritization; data older than one season has no
-- operational value. Runs nightly at 04:15 UTC.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-pothole-hits';
select cron.schedule(
    'purge-pothole-hits',
    '15 4 * * *',
    $$
        delete from pothole_hits
        where created_at < now() - interval '90 days';
    $$
);

-- pothole_actions: purge rows older than 90 days.
-- Fill actions are the source of truth for the rate limiter window only;
-- the pothole's filled_at timestamp on the potholes table is the durable record.
-- Runs nightly at 04:30 UTC.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-pothole-actions';
select cron.schedule(
    'purge-pothole-actions',
    '30 4 * * *',
    $$
        delete from pothole_actions
        where created_at < now() - interval '90 days';
    $$
);
