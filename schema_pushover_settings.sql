-- Migration: Pushover notification toggles in site_settings
-- Run after schema_site_settings.sql
-- Inserts default values (all enabled) if not already present.

INSERT INTO site_settings (key, value)
VALUES
    ('pushover_enabled',          'true'),
    ('pushover_notify_photos',    'true'),
    ('pushover_notify_community', 'true'),
    ('pushover_notify_security',  'true')
ON CONFLICT (key) DO NOTHING;
