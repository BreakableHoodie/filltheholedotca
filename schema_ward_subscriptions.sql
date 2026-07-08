-- schema_ward_subscriptions.sql
-- Ward-level "new pothole" push subscriptions. Each row binds an anonymous
-- browser push subscription to one council ward. Service-role only.
create table ward_subscriptions (
    id         uuid        primary key default gen_random_uuid(),
    ward_key   text        not null,
    endpoint   text        not null,
    p256dh     text        not null,
    auth       text        not null,
    created_at timestamptz not null default now(),
    unique (ward_key, endpoint)
);
alter table ward_subscriptions enable row level security;
create index ward_subscriptions_ward_idx on ward_subscriptions (ward_key);

grant select, insert, delete on ward_subscriptions to service_role;

-- Extend the rate-limit scope constraint to allow the new ward scope. This lists
-- the UNION of all scopes in use so none is dropped regardless of migration order
-- or manually-applied live-DB state.
alter table api_rate_limit_events drop constraint if exists api_rate_limit_events_scope_check;
alter table api_rate_limit_events add constraint api_rate_limit_events_scope_check
  check (scope in (
    'report_submit',
    'photo_upload',
    'hit_submit',
    'push_subscribe',
    'push_unsubscribe',
    'fill_notify_subscribe',
    'vote_submit',
    'ward_notify_subscribe'
  ));
