-- Run this in your Supabase SQL editor to add community confirmation support

ALTER TABLE potholes ADD COLUMN IF NOT EXISTS confirmed_count int default 1;

-- Drop columns no longer used
ALTER TABLE potholes DROP COLUMN IF EXISTS photo_url;
ALTER TABLE potholes DROP COLUMN IF EXISTS filled_url;
ALTER TABLE potholes DROP COLUMN IF EXISTS submitter;

-- IP deduplication table (stores hashed IPs only — no raw PII)
CREATE TABLE IF NOT EXISTS pothole_confirmations (
  id          uuid primary key default gen_random_uuid(),
  pothole_id  uuid not null references potholes(id) on delete cascade,
  ip_hash     text not null,
  created_at  timestamptz default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pothole_confirmations_unique
  ON pothole_confirmations (pothole_id, ip_hash);

ALTER TABLE pothole_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert confirmations"
  ON pothole_confirmations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public read confirmations"
  ON pothole_confirmations FOR SELECT
  USING (true);

-- Optimize for geospatial queries (status + bounding box)
create index if not exists potholes_geo_idx on potholes (status, lat, lng);

-- Optimize for feed/map loading (status != pending, order by created_at)
create index if not exists potholes_feed_idx on potholes (created_at desc) where status != 'pending';
