-- Run this in your Supabase SQL editor

create table if not exists potholes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  lat         float8 not null,
  lng         float8 not null,
  address     text,
  description text,
  status      text default 'reported',  -- 'pending' | 'reported' | 'filled' | 'expired' (legacy: 'wanksyd')
  wanksy_at   timestamptz,             -- kept for historical rows
  filled_at   timestamptz,
  expired_at  timestamptz,
  confirmed_count int default 1
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

-- Allow anyone to update potholes (for status advancement)
-- ideally this would restrict columns, but the app uses anon key for updates
create policy "Public update"
  on potholes for update
  using (true)
  with check (true);

-- Allow anyone to read confirmations (needed for client-side check)
create policy "Public read confirmations"
  on pothole_confirmations for select
  using (true);

-- Allow anyone to insert confirmations
create policy "Public insert confirmations"
  on pothole_confirmations for insert
  with check (true);

-- Tracks per-pothole per-IP status transitions (wanksy, filled)
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
    status = case when confirmed_count + 1 >= 3 then 'reported' else status end
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
--   CHECK (status IN ('pending', 'reported', 'wanksyd', 'filled', 'expired'));
-- Note: 'wanksyd' kept in constraint for historical rows.

-- pg_cron: nightly expiry job (run once in Supabase SQL editor)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'expire-old-potholes',
--   '0 3 * * *',
--   $$
--     UPDATE potholes
--     SET status = 'expired', expired_at = NOW()
--     WHERE status = 'reported'
--       AND created_at < NOW() - INTERVAL '6 months';
--   $$
-- );

-- Storage bucket: create a public bucket called 'pothole-photos'
-- In Supabase dashboard: Storage → New Bucket → Name: pothole-photos → Public: ON
-- Then add these storage policies:
--
-- Policy: Allow public uploads
--   Operation: INSERT
--   Target roles: anon, authenticated
--   Policy: true
--
-- Policy: Allow public reads
--   Operation: SELECT
--   Target roles: anon, authenticated
--   Policy: true
