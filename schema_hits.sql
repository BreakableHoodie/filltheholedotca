-- schema_hits.sql
-- "I hit this" signal: records when community members indicate they physically drove over a pothole.
-- One hit per IP per pothole. Counts are returned as aggregates only — raw ip_hash never exposed.

create table pothole_hits (
    id         uuid        primary key default gen_random_uuid(),
    pothole_id uuid        not null references potholes(id) on delete cascade,
    ip_hash    text        not null,
    created_at timestamptz not null default now()
);

create unique index pothole_hits_uniq on pothole_hits(pothole_id, ip_hash);

-- RLS: no anon SELECT (ip_hash correlation risk). Inserts and count queries via service-role.
alter table pothole_hits enable row level security;
