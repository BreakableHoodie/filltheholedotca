-- schema_push_subscription_ttl.sql
-- Adds last_used_at tracking to push_subscriptions and a pg_cron cleanup job
-- that purges subscriptions not refreshed in 180 days (PRIV-5 / PIPEDA data minimization).

-- Add as nullable first so the backfill can run before the NOT NULL constraint is applied.
alter table push_subscriptions
    add column if not exists last_used_at timestamptz;

-- Back-fill: treat existing rows as last used at creation time.
update push_subscriptions
set last_used_at = created_at
where last_used_at is null;

-- Now lock in the default and NOT NULL constraint.
alter table push_subscriptions
    alter column last_used_at set default now();
alter table push_subscriptions
    alter column last_used_at set not null;

-- Nightly job: delete push subscriptions not refreshed in 180 days.
-- Unschedule first (safe no-op if job doesn't exist) to keep the migration idempotent.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-stale-push-subscriptions';
select cron.schedule(
    'purge-stale-push-subscriptions',
    '30 4 * * *',
    $$
        delete from push_subscriptions
        where last_used_at < now() - interval '180 days';
    $$
);
