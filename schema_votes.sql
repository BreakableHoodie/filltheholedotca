-- schema_votes.sql
-- Tier 2 voting: upvote/downvote signal for community prioritization.
-- One vote per IP per pothole. vote_direction: 1 = upvote, -1 = downvote.
-- Vote counts are returned as aggregates only — raw ip_hash never exposed.

create table pothole_votes (
    id              uuid        primary key default gen_random_uuid(),
    pothole_id      uuid        not null references potholes(id) on delete cascade,
    ip_hash         text        not null,
    vote_direction  smallint    not null check (vote_direction in (1, -1)),
    created_at      timestamptz not null default now()
);

create unique index pothole_votes_uniq on pothole_votes(pothole_id, ip_hash);

-- RLS: no anon SELECT (ip_hash correlation risk). Inserts, updates, and count queries via service-role.
alter table pothole_votes enable row level security;
