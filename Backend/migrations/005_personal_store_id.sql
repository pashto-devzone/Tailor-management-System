-- Migration 005: Personal store ID for operational database isolation.
--
-- Tracks the operational store ID in each user's personal Supabase database.
-- Central users (has_personal_db = FALSE) keep using central store_id.
-- New users with a personal DB get their own store initialized there.
--
-- Safe to re-run. Does not modify any existing data.
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_store_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_users_personal_store_id ON users(personal_store_id);
