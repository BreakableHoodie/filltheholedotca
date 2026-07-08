-- schema_pothole_reported_at.sql
-- Fix #198: the polling endpoint (/api/potholes/recent) could not surface a
-- pending -> reported transition because that flip updated no timestamp column.
-- Add reported_at, set it when increment_confirmation promotes a pothole, and
-- backfill existing non-pending rows so they aren't treated as "just reported".
alter table potholes add column if not exists reported_at timestamptz;

update potholes set reported_at = created_at
where reported_at is null and status <> 'pending';

create index if not exists potholes_reported_at_idx
  on potholes (reported_at) where reported_at is not null;

-- Redefine increment_confirmation (3-param signature) to stamp reported_at on the
-- pending -> reported flip. Body is identical to schema_site_settings.sql EXCEPT
-- the flip UPDATE also sets reported_at = now().
CREATE OR REPLACE FUNCTION increment_confirmation(
	p_pothole_id  uuid,
	p_ip_hash     text,
	p_threshold   int DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
	v_count  int;
	v_status text;
BEGIN
	INSERT INTO pothole_confirmations (pothole_id, ip_hash)
	VALUES (p_pothole_id, p_ip_hash)
	ON CONFLICT (pothole_id, ip_hash) DO NOTHING;

	IF NOT FOUND THEN
		RETURN jsonb_build_object('duplicate', true);
	END IF;

	UPDATE potholes
	SET confirmed_count = confirmed_count + 1
	WHERE id = p_pothole_id
	RETURNING confirmed_count, status INTO v_count, v_status;

	IF v_count >= p_threshold AND v_status = 'pending' THEN
		UPDATE potholes SET status = 'reported', reported_at = now() WHERE id = p_pothole_id;
		v_status := 'reported';
	END IF;

	RETURN jsonb_build_object(
		'duplicate',       false,
		'confirmed_count', v_count,
		'status',          v_status
	);
END;
$$;
