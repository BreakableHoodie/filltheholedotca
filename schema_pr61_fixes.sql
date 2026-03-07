-- ─── PR #61 fixes ────────────────────────────────────────────────────────────

-- 1. Enforce photos_published in the RLS policy so PostgREST cannot expose
--    approved photo metadata for potholes where the admin has not yet published
--    photos. Without this, clients can query pothole_photos via the anon key
--    and retrieve metadata even when photos_published = false.
drop policy if exists "Public read approved photos" on pothole_photos;

create policy "Public read approved photos"
  on pothole_photos for select
  using (
    moderation_status = 'approved'
    and (select photos_published from potholes where id = pothole_id)
  );

-- 2. Backfill: promote pending potholes that already have confirmed_count >= 2
--    (the new threshold). These rows were held back under the old 3-confirmation
--    rule and must be promoted now that the bar is lower.
update potholes
set status = 'reported'
where status = 'pending'
  and confirmed_count >= (
    select coalesce(nullif(value, '')::int, 2)
    from site_settings
    where key = 'confirmation_threshold'
  );
