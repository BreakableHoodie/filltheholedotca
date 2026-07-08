-- schema_votes_ttl.sql
-- PIPEDA data minimization: purge pothole_votes rows older than 90 days.
-- Vote signals older than one season have no operational value.

select cron.unschedule(jobid) from cron.job where jobname = 'purge-pothole-votes';
select cron.schedule(
    'purge-pothole-votes',
    '45 5 * * *',  -- 05:45 UTC nightly (between push-subscription purge at 05:00 and admin-auth purge at 05:30)
    $$
        delete from pothole_votes
        where created_at < now() - interval '90 days';
    $$
);
