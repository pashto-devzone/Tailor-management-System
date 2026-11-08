"use strict";

const {
  getPublicConfigByUserId,
  getConfigByUserId,
  hasPersonalDb,
  upsertConfig,
  updateStatus,
  removeConfig,
  initializePersonalStore,
} = require("../models/userSupabaseConfigModel");
const db = require("../config/db");
const personalDb = require("../services/personalDb");

function normalizeConnectionInput(body) {
  const src = body || {};
  const normalized = personalDb.normalizeConfig({
    connectionString: src.connectionString || src.connection_string || src.uri || src.connectionUri || src.connection_uri,
    connectionHost: src.connectionHost || src.host || src.connection_host,
    connectionPort: src.connectionPort || src.port || src.connection_port,
    connectionDatabase: src.connectionDatabase || src.database || src.connection_database || src.dbName || src.db_name,
    connectionUsername: src.connectionUsername || src.username || src.connection_username || src.user,
    connectionPassword: src.connectionPassword || src.password || src.connection_password,
    sslMode: src.sslMode || src.ssl_mode || src.ssl,
    projectUrl: src.projectUrl || src.project_url,
    projectName: src.projectName || src.project_name,
    anonKey: src.anonKey || src.anon_key,
  });
  return normalized;
}

exports.getConfig = async (req, res) => {
  const userId = req.user.id;
  try {
    const config = await getPublicConfigByUserId(userId);
    const hasPersonal = await hasPersonalDb(userId);
    return res.json({
      has_personal_db: hasPersonal,
      config: config || null,
      using_central_db: !hasPersonal,
    });
  } catch (err) {
    return res.status(500).json({ message: "Unable to load Supabase configuration." });
  }
};

exports.saveConfig = async (req, res) => {
  const userId = req.user.id;
  let normalized;
  try {
    normalized = normalizeConnectionInput(req.body);
  } catch (err) {
    return res.status(err.status || 400).json({ message: err.message || "Invalid connection configuration." });
  }

  try {
    const test = await personalDb.testConnection(normalized);
    if (!test.ok) {
      return res.status(422).json({ message: "Connection failed.", error: test.error });
    }
    if (!test.schema_ok) {
      return res.status(422).json({
        message: "Connected, but schema initialization failed.",
        missing_tables: test.missing_tables,
        error: "Required tables are missing.",
      });
    }

    const config = await upsertConfig({
      userId,
      host: normalized.host,
      port: normalized.port,
      database: normalized.database,
      username: normalized.username,
      password: normalized.password,
      sslMode: normalized.sslMode,
      projectUrl: normalized.projectUrl,
      projectName: normalized.projectName,
      anonKey: normalized.anonKey,
      status: "verified",
      schemaOk: true,
    });
    await updateStatus(userId, "verified", null, true, true);

    const fullConfig = await getConfigByUserId(userId);

// Initialize store in the user's personal database
let personalStoreId = null;
try {
  const userRow = await db.prepare("SELECT id, name, email FROM users WHERE id = ? LIMIT 1").get(userId);
  const storeResult = await initializePersonalStore(userId, { name: userRow.name, email: userRow.email }, fullConfig);
  personalStoreId = storeResult.store.id;
} catch (err) {
  console.error("[saveConfig] personal store initialization failed:", err.message);
}

return res.json({
  message: "Supabase project connected and verified.",
  config,
  personal_store_id: personalStoreId,
});
  } catch (err) {
    const status = err.status || 500;
    try { await updateStatus(userId, "error", err.message || "Connection failed", true, false); } catch (_) {}
    return res.status(status).json({
      message: err.message || "Failed to save Supabase configuration.",
      error: personalDb.safeError(err),
    });
  }
};

exports.testConnection = async (req, res) => {
  let normalized;
  try {
    normalized = normalizeConnectionInput(req.body);
  } catch (err) {
    return res.status(err.status || 400).json({ ok: false, error: err.message || "Invalid connection configuration." });
  }
  try {
    const result = await personalDb.testConnection(normalized);
    return res.json({
      ok: result.ok && result.schema_ok,
      connection_ok: result.ok,
      schema_ok: result.schema_ok,
      database: result.database,
      user: result.user,
      missing_tables: result.missing_tables,
      initialized: result.initialized,
      error: result.error,
    });
  } catch (err) {
    return res.status(err.status || 400).json({
      ok: false,
      connection_ok: false,
      schema_ok: false,
      error: err.message || "Connection test failed.",
      detail: err.detail || personalDb.safeError(err),
    });
  }
};

exports.disconnect = async (req, res) => {
  const userId = req.user.id;
  try {
    const { invalidateCache } = require("../services/personalDb");
    invalidateCache(userId);
    await removeConfig(userId);
    return res.json({
      message: "Personal Supabase project disconnected. Your account now uses the central TMS database.",
      has_personal_db: false,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to disconnect Supabase project." });
  }
};

module.exports = exports;
