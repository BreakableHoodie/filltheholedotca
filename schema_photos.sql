-- Run this in your Supabase SQL editor to add photo upload support

create table if not exists pothole_photos (
  id                uuid primary key default gen_random_uuid(),
  pothole_id        uuid not null references potholes(id) on delete cascade,
  storage_path      text not null,
  ip_hash           text,    -- HMAC-SHA-256 hash of uploader IP (no raw IP stored)
  moderation_status text not null default 'pending'
                    check (moderation_status in ('pending', 'approved', 'rejected')),
  moderation_score  float8,  -- highest flagging score from SightEngine (0.0–1.0)
  created_at        timestamptz default now()
);

alter table pothole_photos add column if not exists ip_hash text;

create index if not exists pothole_photos_pothole_idx on pothole_photos (pothole_id);
create index if not exists pothole_photos_ip_hash_created_idx on pothole_photos (ip_hash, created_at desc);

alter table pothole_photos enable row level security;

-- Only approved photos are visible to the public anon key
create policy "Public read approved photos"
  on pothole_photos for select
  using (moderation_status = 'approved');

-- Inserts are always done server-side via the service role key (bypasses RLS),
-- so no public insert policy is needed here.

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
