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
-- The exact signature must match the function defined in schema_site_settings.sql.
-- If the function was previously defined without explicit REVOKE, PostgreSQL
-- grants EXECUTE to PUBLIC by default — this revokes that grant.
REVOKE EXECUTE ON FUNCTION increment_confirmation(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_confirmation(uuid, text, integer) FROM authenticated;

-- ---------------------------------------------------------------------------
-- H3: Document the 'deferred' moderation status
-- ---------------------------------------------------------------------------
-- pothole_photos.moderation_status is a text column (no enum constraint).
-- Valid values after this migration:
--   'pending'  — SightEngine accepted; awaiting admin approval
--   'approved' — admin has approved; visible to the public
--   'rejected' — admin has rejected; not visible to the public
--   'deferred' — SightEngine was unavailable; requires mandatory admin review
--
-- The existing RLS SELECT policy (anon key sees only 'approved' rows) covers
-- 'deferred' automatically — no policy change needed.
-- The admin photo queue should surface 'deferred' photos distinctly from
-- 'pending' so they receive prioritised attention.
--
-- No DDL change required — the column already accepts any text value.
-- This comment serves as the canonical record of the added status.
