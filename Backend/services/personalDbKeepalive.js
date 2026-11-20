"use strict";

const db = require("../config/db");
const personalDb = require("./personalDb");
const { decrypt } = require("../helpers/encryption");

let timer = null;
let initialTimer = null;

async function runKeepalives() {
  // The central flag is the sole selector: central-database accounts are never
  // sent a keep-alive query. This can run only while the desktop app is open.
  const users = await db.central.all(
    `SELECT c.user_id, c.connection_host, c.connection_port, c.connection_database,
            c.connection_username, c.encrypted_password, c.ssl_mode, c.last_keepalive_at
       FROM user_supabase_configs c JOIN users u ON u.id = c.user_id
      WHERE u.has_personal_db = TRUE AND c.status = 'verified' AND c.schema_ok = TRUE`
  );
  const threshold = Date.now() - 24 * 60 * 60 * 1000;
  for (const row of users) {
    if (row.last_keepalive_at && new Date(row.last_keepalive_at).getTime() > threshold) continue;
    let pool;
    try {
      const config = {
        host: row.connection_host, port: row.connection_port,
        database: row.connection_database, username: row.connection_username,
        password: decrypt(row.encrypted_password), sslMode: row.ssl_mode || "no-verify",
      };
      pool = personalDb.getPool(config, row.user_id);
      await personalDb.pingPersonalDatabase(pool);
      await require("../models/userSupabaseConfigModel").recordKeepalive(row.user_id, true);
      console.log(`[keepalive] user ${row.user_id}: ok`);
    } catch (error) {
      const category = personalDb.categorizeError(error);
      try { await require("../models/userSupabaseConfigModel").recordKeepalive(row.user_id, false, category.code); } catch (_) {}
      if (pool) personalDb.invalidateCache(row.user_id);
      console.warn(`[keepalive] user ${row.user_id}: failed (${category.code})`);
    }
  }
}

function start() {
  if (initialTimer || timer) return;
  initialTimer = setTimeout(() => {
    initialTimer = null;
    runKeepalives().catch((error) => console.warn(`[keepalive] scan failed (${error.code || "central_unavailable"})`));
    timer = setInterval(() => runKeepalives().catch((error) => console.warn(`[keepalive] scan failed (${error.code || "central_unavailable"})`)), 12 * 60 * 60 * 1000);
    timer.unref?.();
  }, 20_000);
  initialTimer.unref?.();
}

function stop() {
  clearTimeout(initialTimer);
  clearInterval(timer);
  initialTimer = null;
  timer = null;
}

module.exports = { start, stop, runKeepalives };
