-- Add JSON-encoded print configuration to the existing settings table.
-- Follows the same out-of-band migration pattern as 002. Safe to re-run on
-- PostgreSQL 9.6+. The local development SQLite database receives this column
-- automatically from Backend/config/db.js on startup.
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS printsettings TEXT;
