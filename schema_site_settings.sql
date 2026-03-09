-- Site-wide configurable settings
CREATE TABLE IF NOT EXISTS site_settings (
	key         text        PRIMARY KEY,
	value       text        NOT NULL,
	updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Threshold value is displayed publicly (pending notice on hole detail page)
CREATE POLICY "site_settings_public_read"
	ON site_settings FOR SELECT USING (true);
-- All writes require the service-role key (no INSERT/UPDATE/DELETE policy)

-- Defaults
INSERT INTO site_settings (key, value) VALUES
	('confirmation_threshold', '2')
ON CONFLICT (key) DO NOTHING;

-- Update increment_confirmation to accept the threshold as a parameter
-- so the app can pass the live DB value without the function needing a self-join.
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
		UPDATE potholes SET status = 'reported' WHERE id = p_pothole_id;
		v_status := 'reported';
	END IF;

	RETURN jsonb_build_object(
		'duplicate',       false,
		'confirmed_count', v_count,
		'status',          v_status
	);
END;
$$;
