-- Migration 002: Add project_url and related columns to settings table
-- This migration adds columns that the application code expects in the settings table:
-- project_url, anon_key_masked, has_personal_db
-- The original migration 001 created the settings table without these columns,
-- but the code references them in UPDATE/INSERT queries.

-- Add new columns to existing settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS project_url TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS anon_key_masked TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS has_personal_db BOOLEAN NOT NULL DEFAULT FALSE;

-- Set default values for existing rows
UPDATE settings SET has_personal_db = FALSE WHERE has_personal_db IS NULL;
UPDATE settings SET project_url = NULL WHERE project_url IS NULL;
UPDATE settings SET anon_key_masked = NULL WHERE anon_key_masked IS NULL;

-- Update the sequence counter to reflect new rows
SELECT setval(pg_get_serial_sequence('settings', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM settings), 1));

-- Add comment documenting the change
COMMENT ON COLUMN settings.project_url IS 'Supabase project URL for personal database configuration';
COMMENT ON COLUMN settings.anon_key_masked IS 'Masked anonymous key for personal database';
COMMENT ON COLUMN settings.has_personal_db IS 'Flag indicating if user has personal Supabase project configured';