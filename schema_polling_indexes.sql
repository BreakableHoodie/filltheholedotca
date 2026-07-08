-- schema_polling_indexes.sql
-- Fix #205: index the filled_at/expired_at OR-arms of the /api/potholes/recent
-- poll filter so the planner can BitmapOr instead of scanning all non-pending rows.
create index if not exists potholes_filled_at_idx  on potholes (filled_at)  where filled_at  is not null;
create index if not exists potholes_expired_at_idx on potholes (expired_at) where expired_at is not null;
