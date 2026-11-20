-- Nullable diagnostics for keep-alive activity against personal databases.
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS last_keepalive_at TIMESTAMPTZ;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS last_keepalive_ok BOOLEAN;
ALTER TABLE user_supabase_configs ADD COLUMN IF NOT EXISTS last_keepalive_error TEXT;