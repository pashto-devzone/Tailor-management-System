-- Migration 004: Per-user personal Supabase/PostgreSQL project configuration.

CREATE TABLE IF NOT EXISTS user_supabase_configs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_host TEXT,
  connection_port INTEGER,
  connection_database TEXT,
  connection_username TEXT,
  encrypted_password TEXT,
  password_masked TEXT,
  ssl_mode TEXT DEFAULT 'no-verify',
  project_url TEXT,
  project_name TEXT,
  encrypted_anon_key TEXT,
  anon_key_masked TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  schema_checked BOOLEAN NOT NULL DEFAULT FALSE,
  schema_ok BOOLEAN NOT NULL DEFAULT FALSE,
  last_tested_at TIMESTAMPTZ,
  last_test_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_supabase_configs_user_id_unique UNIQUE (user_id)
);

-- Ensure columns exist on older installs.
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS connection_host TEXT;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS connection_port INTEGER;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS connection_database TEXT;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS connection_username TEXT;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS encrypted_password TEXT;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS password_masked TEXT;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS ssl_mode TEXT DEFAULT 'no-verify';
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS project_url TEXT;
ALTER TABLE user_supabase_configs ALTER COLUMN project_url DROP NOT NULL;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS encrypted_anon_key TEXT;
ALTER TABLE user_supabase_configs ALTER COLUMN encrypted_anon_key DROP NOT NULL;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS anon_key_masked TEXT;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS schema_checked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS schema_ok BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS last_test_error TEXT;

CREATE INDEX IF NOT EXISTS idx_user_supabase_configs_user_id ON user_supabase_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_supabase_configs_status ON user_supabase_configs(status);

ALTER TABLE users ADD COLUMN IF NOT EXISTS has_personal_db BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_has_personal_db ON users(has_personal_db);


