-- Migration: photos_published flag + confirmation threshold change (3 → 2)
-- Run this in your Supabase SQL editor after schema_actions.sql

-- A pothole being "reported" (live on map) does NOT mean its photos are visible.
-- Admin explicitly sets photos_published = true to make approved photos appear publicly.
ALTER TABLE potholes ADD COLUMN IF NOT EXISTS photos_published boolean NOT NULL DEFAULT false;

-- Lower the confirmation threshold from 3 to 2.
-- CREATE OR REPLACE is safe to re-run.
CREATE OR REPLACE FUNCTION increment_confirmation(p_pothole_id uuid, p_ip_hash text)
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
  SET
    confirmed_count = confirmed_count + 1,
    status = CASE WHEN confirmed_count + 1 >= 2 THEN 'reported' ELSE status END
  WHERE id = p_pothole_id
  RETURNING confirmed_count, status INTO v_count, v_status;

  RETURN jsonb_build_object(
    'duplicate',        false,
    'confirmed_count',  v_count,
    'status',           v_status
  );
END;
$$;
