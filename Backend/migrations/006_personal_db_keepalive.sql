-- Additive, idempotent keep-alive table for a user's own database.
CREATE TABLE IF NOT EXISTS keepalive_ping (
  id INTEGER PRIMARY KEY,
  pinged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);