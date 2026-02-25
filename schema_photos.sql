-- Run this in your Supabase SQL editor to add photo upload support

create table if not exists pothole_photos (
  id                uuid primary key default gen_random_uuid(),
  pothole_id        uuid not null references potholes(id) on delete cascade,
  storage_path      text not null,
  moderation_status text not null default 'pending'
                    check (moderation_status in ('pending', 'approved', 'rejected')),
  moderation_score  float8,  -- highest flagging score from SightEngine (0.0–1.0)
  created_at        timestamptz default now()
);

create index if not exists pothole_photos_pothole_idx on pothole_photos (pothole_id);

alter table pothole_photos enable row level security;

-- Only approved photos are visible to the public anon key
create policy "Public read approved photos"
  on pothole_photos for select
  using (moderation_status = 'approved');

-- Inserts are always done server-side via the service role key (bypasses RLS),
-- so no public insert policy is needed here.
