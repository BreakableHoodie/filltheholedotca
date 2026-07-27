-- schema_private_photo_bucket.sql — Migration #32
-- Make the pothole-photos storage bucket private (#245).
--
-- WHY: a public object URL is permanent. Once shared, scraped, or archived it
-- keeps serving after a photo is unpublished (photos_published toggled off) or
-- rejected — it outlives the moderation decision entirely. Deleting the object
-- on reject (#252) only helps when someone actually presses reject; a merely
-- unpublished photo stayed reachable forever at a URL already in the wild.
--
-- Every read path now mints a short-lived signed URL server-side via the
-- service-role client, so no public read is required:
--   - src/routes/hole/[id]/+page.server.ts            (public detail page, 1h)
--   - src/routes/admin/photos/+page.server.ts         (moderation queue, 1h)
--   - src/routes/admin/potholes/[id]/+page.server.ts  (admin detail, 1h)
--
-- ============================================================================
-- DEPLOY ORDER — READ BEFORE RUNNING
-- ============================================================================
-- Signed URLs work against a public bucket, so the application code is safe to
-- ship first and MUST be. Sequence:
--   1. Deploy the signed-URL application code (PR #254).
--   2. Load a /hole/[id] page with published photos and confirm they render.
--   3. Only then run this migration.
-- Running this BEFORE the code deploys breaks every photo on the live site
-- until the deploy lands.
-- ============================================================================
--
-- Idempotent: safe to re-run. Values mirror the bucket's existing configuration
-- (5 MiB limit; JPEG/PNG/WebP) so a from-scratch environment lands in the same
-- state as production rather than on Supabase defaults.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pothole-photos',
  'pothole-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Do NOT add a SELECT policy on storage.objects for anon here. Signed URLs are
-- minted with the service-role key, which bypasses RLS — granting anon read
-- would silently re-open the direct-object-access hole this migration closes.
-- The INSERT policy for uploads (see schema.sql) is unchanged and still needed.

-- Verify (expect public = false):
--   select id, public, file_size_limit from storage.buckets where id = 'pothole-photos';
