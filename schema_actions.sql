-- Migration: pothole_actions table + increment_confirmation RPC
-- Run this in your Supabase SQL editor after schema_update.sql

-- Tracks per-pothole per-IP status transitions (wanksy, filled).
-- Unique constraint prevents the same device from triggering the same
-- transition more than once, and provides an audit trail.
create table if not exists pothole_actions (
  id          uuid primary key default gen_random_uuid(),
  pothole_id  uuid not null references potholes(id) on delete cascade,
  ip_hash     text not null,
  action      text not null check (action in ('wanksy', 'filled')),
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
