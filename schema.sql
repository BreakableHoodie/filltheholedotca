-- Run this in your Supabase SQL editor

create table if not exists potholes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  lat         float8 not null,
  lng         float8 not null,
  address     text,
  description text,
  status      text default 'reported',  -- 'reported' | 'wanksyd' | 'filled'
  wanksy_at   timestamptz,
  filled_at   timestamptz,
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
