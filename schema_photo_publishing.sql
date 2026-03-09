-- Migration: photos_published flag + confirmation threshold change (3 → 2)
-- Run this in your Supabase SQL editor after schema_actions.sql

-- A pothole being "reported" (live on map) does NOT mean its photos are visible.
-- Admin explicitly sets photos_published = true to make approved photos appear publicly.
ALTER TABLE potholes ADD COLUMN IF NOT EXISTS photos_published boolean NOT NULL DEFAULT false;

-- NOTE: increment_confirmation() is intentionally NOT redefined here.
-- schema_site_settings.sql (which must run after this file) defines the
-- current 3-parameter signature: increment_confirmation(p_pothole_id, p_ip_hash, p_threshold).
-- Redefining it here with 2 parameters would overwrite the newer version and
-- break the application. Run migrations in order:
--   schema.sql → schema_update.sql → schema_photos.sql →
--   schema_photo_publishing.sql → schema_site_settings.sql → schema_pr61_fixes.sql
