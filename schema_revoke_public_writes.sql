-- schema_revoke_public_writes.sql
-- SECURITY (critical): remove public write access to potholes / confirmations / actions.
--
-- The write flows were migrated to the service-role client long ago, but the
-- original public write RLS policies were never dropped AND `anon` still carried
-- Supabase's legacy broad table grants. With the anon key (shipped in the browser
-- bundle) an attacker could hit PostgREST directly and: INSERT arbitrary potholes,
-- self-INSERT confirmations to force pending reports live, and UPDATE ANY pothole
-- (the "Public update" policy used `USING (true)`) — bypassing geofence, rate
-- limits, coordinate rounding, and the confirmation gate.
--
-- schema_grants.sql GRANTs anon SELECT but never REVOKEd these writes, so this
-- migration does the revoke. All application writes use the service_role client
-- (unaffected); anon retains SELECT for SSR reads (governed by the remaining
-- "Public read non-pending" policy).

-- 1. Drop the public write policies.
DROP POLICY IF EXISTS "Public insert"               ON potholes;
DROP POLICY IF EXISTS "Public update"               ON potholes;
DROP POLICY IF EXISTS "Public insert confirmations" ON pothole_confirmations;
DROP POLICY IF EXISTS "Public insert actions"       ON pothole_actions;

-- 2. Revoke the legacy broad write grants (defense in depth — even if a policy
--    reappears, anon/authenticated cannot write). SELECT is intentionally kept.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON potholes, pothole_confirmations, pothole_actions
  FROM anon, authenticated;
