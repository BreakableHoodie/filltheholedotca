-- schema_grants.sql — Migration #23
-- Explicit Data API table grants.
--
-- Supabase's legacy default auto-granted anon/service_role access to all
-- public-schema tables. Starting October 30, 2026 that default is removed
-- from existing projects: any table without an explicit GRANT will return a
-- 42501 error from PostgREST. Run this after all prior migrations.
--
-- Access rationale:
--   anon       — the public Supabase anon key; used by SSR page loaders
--                and the JSON/XML feeds. RLS policies further restrict
--                which rows are visible.
--   service_role — bypasses RLS; used exclusively by server-side API routes
--                  (src/routes/api/*) and admin backend routes.

-- ---------------------------------------------------------------------------
-- anon — public-facing SSR reads only
-- ---------------------------------------------------------------------------

-- potholes: read by home page, layout, stats, hole detail, feed.json, feed.xml,
--   export.csv, and OG image routes. RLS "Public read" policy filters pending rows.
grant select on public.potholes to anon;

-- pothole_photos: read by hole detail page via the public anon client.
--   RLS "Public read approved photos" policy restricts to approved + published rows.
grant select on public.pothole_photos to anon;

-- site_settings: public RLS policy "site_settings_public_read" exists for this
--   table; grant included so that policy can be exercised by client-side code.
grant select on public.site_settings to anon;

-- Note: RLS INSERT policies on potholes, pothole_confirmations, and
-- pothole_actions referencing the anon role are dead code — all writes to
-- those tables now go through the service_role client. Those policies are
-- not granted here (least privilege). They remain in the schema as harmless
-- no-ops rather than requiring a destructive migration on live tables.

-- ---------------------------------------------------------------------------
-- service_role — all server-side API and admin writes
-- ---------------------------------------------------------------------------

-- Public-facing tables
grant select, insert, update, delete on public.potholes                   to service_role;
grant select, insert, update, delete on public.pothole_confirmations      to service_role;
grant select, insert, update, delete on public.pothole_actions            to service_role;
grant select, insert, update, delete on public.api_rate_limit_events      to service_role;
grant select, insert, update, delete on public.pothole_photos             to service_role;
grant select, insert, update, delete on public.pothole_hits               to service_role;
grant select, insert, update, delete on public.pothole_votes             to service_role;
grant select, insert, update, delete on public.push_subscriptions         to service_role;
grant select, insert, update, delete on public.pothole_fill_subscriptions to service_role;
grant select, insert, update, delete on public.site_settings              to service_role;

-- Admin backend tables (no anon policies; service_role exclusively)
grant select, insert, update, delete on public.admin_users           to service_role;
grant select, insert, update, delete on public.admin_sessions        to service_role;
grant select, insert, update, delete on public.admin_invite_codes    to service_role;
grant select, insert, update, delete on public.admin_mfa_challenges  to service_role;
grant select, insert, update, delete on public.admin_trusted_devices to service_role;
grant select, insert, update, delete on public.admin_auth_attempts   to service_role;
grant select, insert, update, delete on public.admin_audit_log       to service_role;
grant select, insert, update, delete on public.admin_password_resets to service_role;
