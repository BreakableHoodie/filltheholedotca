-- Run this in your Supabase SQL editor

create table if not exists potholes (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  lat              float8 not null,
  lng              float8 not null,
  address          text,
  description      text,
  status           text default 'reported',  -- 'pending' | 'reported' | 'filled' | 'expired'
  reported_at      timestamptz,
  filled_at        timestamptz,
  expired_at       timestamptz,
  confirmed_count  int default 1,
  photos_published boolean not null default false  -- admin-controlled; published pothole ≠ published photos
);

-- IP deduplication table (stores hashed IPs only — no raw PII)
create table if not exists pothole_confirmations (
  id          uuid primary key default gen_random_uuid(),
  pothole_id  uuid not null references potholes(id) on delete cascade,
  ip_hash     text not null,
  created_at  timestamptz default now()
);

-- Optimize for geospatial queries (status + bounding box)
create index if not exists potholes_geo_idx on potholes (status, lat, lng);

-- Optimize for feed/map loading (status != pending, order by created_at)
create index if not exists potholes_feed_idx on potholes (created_at desc) where status != 'pending';

-- Unique index for confirmations
create unique index if not exists pothole_confirmations_unique on pothole_confirmations (pothole_id, ip_hash);

-- Enable Row Level Security
alter table potholes enable row level security;
alter table pothole_confirmations enable row level security;

-- Allow anyone to read potholes
create policy "Public read"
  on potholes for select
  using (true);

-- Allow anyone to insert potholes
create policy "Public insert"
  on potholes for insert
  with check (true);

-- No public UPDATE policy for potholes.
-- All status transitions (filled) are performed server-side using the service
-- role key via src/routes/api/filled/+server.ts which validates the request
-- (geofence, rate limit, pothole_actions dedup) before writing. Removing the
-- anon-key UPDATE policy closes the window where any caller with the public
-- anon key could modify arbitrary columns via the PostgREST REST API.

-- Allow anyone to read confirmations (needed for client-side check)
create policy "Public read confirmations"
  on pothole_confirmations for select
  using (true);

-- Allow anyone to insert confirmations
create policy "Public insert confirmations"
  on pothole_confirmations for insert
  with check (true);

-- Tracks per-pothole per-IP status transitions (filled)
create table if not exists pothole_actions (
  id          uuid primary key default gen_random_uuid(),
  pothole_id  uuid not null references potholes(id) on delete cascade,
  ip_hash     text not null,
  action      text not null check (action in ('filled')),
  created_at  timestamptz not null default now(),
  unique (pothole_id, ip_hash, action)
);

alter table pothole_actions enable row level security;

create policy "Public insert actions"
  on pothole_actions for insert
  with check (true);

create policy "Public read actions"
  on pothole_actions for select
  using (true);

-- Persistent API abuse-throttling events keyed by hashed IP.
-- Service-role writes/reads only; no public policies on this table.
create table if not exists api_rate_limit_events (
  id          uuid primary key default gen_random_uuid(),
  ip_hash     text not null,
  scope       text not null check (scope in ('report_submit', 'photo_upload')),
  created_at  timestamptz not null default now()
);

create index if not exists api_rate_limit_events_scope_ip_created_idx
  on api_rate_limit_events (scope, ip_hash, created_at desc);

alter table api_rate_limit_events enable row level security;

-- Atomically inserts a confirmation and increments confirmed_count.
-- Handles duplicate IPs via ON CONFLICT DO NOTHING, eliminating the
-- read-modify-write race condition in the application layer.
create or replace function increment_confirmation(p_pothole_id uuid, p_ip_hash text)
returns jsonb
language plpgsql
as $$
declare
  v_count  int;
  v_status text;
begin
  insert into pothole_confirmations (pothole_id, ip_hash)
  values (p_pothole_id, p_ip_hash)
  on conflict (pothole_id, ip_hash) do nothing;

  if not found then
    return jsonb_build_object('duplicate', true);
  end if;

  update potholes
  set
    confirmed_count = confirmed_count + 1,
    status = case when confirmed_count + 1 >= 2 then 'reported' else status end
  where id = p_pothole_id
  returning confirmed_count, status into v_count, v_status;

  return jsonb_build_object(
    'duplicate',        false,
    'confirmed_count',  v_count,
    'status',           v_status
  );
end;
$$;

-- ============================================================
-- Migration: run these once in the Supabase SQL editor
-- ============================================================
-- ALTER TABLE potholes ADD COLUMN IF NOT EXISTS expired_at timestamptz;
-- ALTER TABLE potholes DROP CONSTRAINT IF EXISTS potholes_status_check;
-- ALTER TABLE potholes ADD CONSTRAINT potholes_status_check
--   CHECK (status IN ('pending', 'reported', 'filled', 'expired'));

-- pg_cron: nightly expiry jobs (run once in Supabase SQL editor, or see schema_sprint3.sql)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Expire reported potholes after 90 days with no fill action:
-- SELECT cron.schedule(
--   'expire-old-potholes',
--   '0 3 * * *',
--   $$
--     UPDATE potholes
--     SET status = 'expired', expired_at = NOW()
--     WHERE status = 'reported'
--       AND created_at < NOW() - INTERVAL '90 days';
--   $$
-- );
-- Expire pending (unconfirmed) potholes after 14 days to prevent merge-radius suppression:
-- SELECT cron.schedule(
--   'expire-stale-pending',
--   '30 3 * * *',
--   $$
--     UPDATE potholes
--     SET status = 'expired', expired_at = NOW()
--     WHERE status = 'pending'
--       AND created_at < NOW() - INTERVAL '14 days';
--   $$
-- );

-- User-submitted photos (pending admin approval before public display)
create table if not exists pothole_photos (
  id                uuid primary key default gen_random_uuid(),
  pothole_id        uuid not null references potholes(id) on delete cascade,
  storage_path      text not null,
  ip_hash           text,
  moderation_status text not null default 'pending'
                    check (moderation_status in ('pending', 'approved', 'rejected')),
  moderation_score  float8,  -- highest flagging score from SightEngine (0.0–1.0)
  created_at        timestamptz default now()
);

alter table pothole_photos add column if not exists ip_hash text;

create index if not exists pothole_photos_pothole_idx on pothole_photos (pothole_id);
create index if not exists pothole_photos_ip_hash_created_idx on pothole_photos (ip_hash, created_at desc);

alter table pothole_photos enable row level security;

-- Only approved photos are visible, AND only when the admin has published
-- photos for that pothole. Both conditions must be true simultaneously.
create policy "Public read approved photos"
  on pothole_photos for select
  using (
    moderation_status = 'approved'
    and (select photos_published from potholes where id = pothole_id)
  );

-- Storage bucket: 'pothole-photos', PRIVATE.
--
-- Created by the statement below, so a from-scratch environment needs no
-- dashboard step. Production was flipped private on 2026-07-27 (migration #32);
-- direct object access now returns 400. An environment that has not yet applied
-- #32 still has a public bucket — do not assume access is blocked there.
--
-- CDN NOTE: flipping the bucket does not purge Cloudflare's edge cache. Objects
-- fetched over a public URL before the flip continue serving from cache until
-- their `cache-control: public, max-age=3600` expires — up to 1h. The origin
-- rejects immediately (verified: cache-busted URL and never-cached object both
-- return 400). Budget for that tail when reasoning about takedown timelines.
--
-- Private is deliberate (#245). A public object URL is permanent and, once
-- shared or scraped, keeps serving after a photo is unpublished or rejected —
-- it outlives the moderation decision entirely. Every read path now mints a
-- short-lived signed URL via the service-role client instead:
--   - src/routes/hole/[id]/+page.server.ts            (public detail page, 1h)
--   - src/routes/admin/photos/+page.server.ts         (moderation queue, 1h)
--   - src/routes/admin/potholes/[id]/+page.server.ts  (admin detail, 1h)
-- The detail-page TTL must stay comfortably above that page's own Cache-Control
-- window (max-age=300 + stale-while-revalidate=600) or cached HTML will
-- reference already-expired URLs.
--
-- No SELECT policy is needed for anon: signed URLs are minted server-side with
-- the service-role key, which bypasses RLS. Granting anon SELECT here would
-- re-open the direct-object-access hole this change closes.
--
-- Policy: Allow public uploads
--   Operation: INSERT
--   Target roles: anon, authenticated
--   Policy: true
--
-- MIGRATION NOTE — order matters for EXISTING environments. Signed URLs work
-- against a public bucket, so deploy the application code FIRST, verify photos
-- still render, and only then apply schema_private_photo_bucket.sql (#32).
-- Flipping first breaks every image on the live site until the deploy lands.
-- A from-scratch environment has no such constraint: there is nothing serving
-- yet, so the statement below can simply run in order.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pothole-photos',
  'pothole-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
