-- Run this in your Supabase SQL editor

create table if not exists potholes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  lat         float8 not null,
  lng         float8 not null,
  address     text,
  description text,
  status      text default 'reported',  -- 'reported' | 'wanksyd' | 'filled'
  photo_url   text,       -- original pothole photo
  wanksy_url  text,       -- after spray-paint photo
  filled_url  text,       -- proof it was filled
  wanksy_at   timestamptz,
  filled_at   timestamptz,
  submitter   text,       -- optional name
  wanksy_by   text        -- who claimed the spray paint
);

-- Enable Row Level Security
alter table potholes enable row level security;

-- Allow anyone to read potholes
create policy "Public read"
  on potholes for select
  using (true);

-- Allow anyone to insert potholes
create policy "Public insert"
  on potholes for insert
  with check (true);

-- Allow anyone to update potholes (for status advancement)
create policy "Public update"
  on potholes for update
  using (true);

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
