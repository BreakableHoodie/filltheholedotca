-- schema_push.sql
-- Web Push subscription storage for browser push notifications.
-- Each row represents one browser/device subscription. Endpoints are unique per device.

create table push_subscriptions (
    id         uuid        primary key default gen_random_uuid(),
    endpoint   text        not null unique,
    p256dh     text        not null,
    auth       text        not null,
    created_at timestamptz not null default now()
);

-- RLS: only service-role can read/write (subscription keys are sensitive).
alter table push_subscriptions enable row level security;
