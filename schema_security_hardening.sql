-- Security hardening migration
-- Addresses findings C1 and H3 from the 2026-03-07 security audit.
-- Run after all prior schema migrations.

-- ---------------------------------------------------------------------------
-- C1: Revoke public execute on increment_confirmation
-- ---------------------------------------------------------------------------
-- The function was callable via the Supabase public REST API using only the
-- anon key, allowing an attacker to supply an arbitrary p_ip_hash and
-- p_threshold, bypassing IP deduplication and the confirmation threshold.
-- The application now calls this via the service-role client exclusively.
--
-- IMPORTANT: Revoking only from 'anon' and 'authenticated' is insufficient —
-- PostgreSQL privilege checks are additive and every role inherits the PUBLIC
-- grant unless it is explicitly revoked. Revoking from PUBLIC removes the
-- grant from all roles, including anon and authenticated.
--
-- The exact signature must match the function defined in schema_site_settings.sql.
REVOKE EXECUTE ON FUNCTION increment_confirmation(uuid, text, integer) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- H3: Add 'deferred' to the moderation_status check constraint
-- ---------------------------------------------------------------------------
-- schema_photos.sql defines an inline check constraint (auto-named by
-- PostgreSQL as pothole_photos_moderation_status_check) that allows only
-- ('pending', 'approved', 'rejected'). Inserting 'deferred' without updating
-- this constraint causes the DB to reject the insert with a constraint
-- violation, breaking the intended "upload but require manual review" flow.
--
-- Valid values after this migration:
--   'pending'  — SightEngine accepted; awaiting admin approval
--   'approved' — admin has approved; visible to the public
--   'rejected' — admin or SightEngine rejected; not visible
--   'deferred' — SightEngine was unavailable; mandatory admin review required
--
-- The existing RLS SELECT policy (anon key sees only 'approved' rows) covers
-- 'deferred' automatically — no RLS change needed.
ALTER TABLE pothole_photos
  DROP CONSTRAINT IF EXISTS pothole_photos_moderation_status_check;

ALTER TABLE pothole_photos
  ADD CONSTRAINT pothole_photos_moderation_status_check
  CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'deferred'));
