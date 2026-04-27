-- schema_fill_notifications.sql
-- Per-pothole fill notification subscriptions. Each row binds a browser push
-- subscription to one pothole. Notifications are one-shot: sent when the pothole
-- is marked filled, then the row is deleted. The pg_cron job is a safety net for
-- subscriptions whose pothole expired before being filled.

create table pothole_fill_subscriptions (
    id          uuid        primary key default gen_random_uuid(),
    pothole_id  uuid        not null references potholes(id) on delete cascade,
    endpoint    text        not null,
    p256dh      text        not null,
    auth        text        not null,
    created_at  timestamptz not null default now(),
    unique (pothole_id, endpoint)
);

-- RLS: only service-role can read/write (push keys are device identifiers).
alter table pothole_fill_subscriptions enable row level security;

-- Nightly cleanup: remove subscriptions for potholes that expired > 7 days ago
-- without ever being filled (their notification will never fire).
-- Runs at 05:15 UTC.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-fill-subscriptions';
select cron.schedule(
    'purge-fill-subscriptions',
    '15 5 * * *',
    $$
        delete from pothole_fill_subscriptions
        where pothole_id in (
            select id from potholes
            where status = 'expired'
            and expired_at < now() - interval '7 days'
        );
    $$
);
