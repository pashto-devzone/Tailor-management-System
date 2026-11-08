"use strict";

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { encrypt, decrypt, mask } = require("../helpers/encryption");

class PersonalDbError extends Error {
  constructor(message, { status = 503, code = "personal_db_unavailable" } = {}) {
    super(message);
    this.name = "PersonalDbError";
    this.status = status;
    this.code = code;
  }
}

const poolCache = new Map();

function parseConnectionString(uri) {
  let url;
  try { url = new URL(uri); } catch (_) {
    throw new PersonalDbError("Invalid connection string.", { status: 400, code: "invalid_config" });
  }
  if (!/^postgres(ql)?:$/i.test(url.protocol)) {
    throw new PersonalDbError("Connection string must use postgres:// or postgresql://.", { status: 400, code: "invalid_config" });
  }
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: decodeURIComponent((url.pathname || "/postgres").replace(/^\//, "") || "postgres"),
    username: decodeURIComponent(url.username || "postgres"),
    password: decodeURIComponent(url.password || ""),
  };
}

function normalizeConfig(input) {
  const src = input || {};
  let host, port, database, username, password;
  const cs = src.connectionString || src.connection_string || src.uri || src.connectionUri || src.connection_uri;
  if (cs) {
    const parsed = parseConnectionString(String(cs));
    host = parsed.host; port = parsed.port; database = parsed.database; username = parsed.username; password = parsed.password;
  } else {
    host = src.connectionHost || src.host || src.connection_host;
    port = src.connectionPort || src.port || src.connection_port;
    database = src.connectionDatabase || src.database || src.connection_database || src.dbName || src.db_name;
    username = src.connectionUsername || src.username || src.connection_username || src.user;
    password = src.connectionPassword || src.password || src.connection_password;
  }
  port = port ? Number(port) : 5432;
  database = database || "postgres";
  const sslMode = src.sslMode || src.ssl_mode || src.ssl || "no-verify";
  const projectUrl = src.projectUrl || src.project_url || null;
  const projectName = src.projectName || src.project_name || null;
  const anonKey = src.anonKey || src.anon_key || null;
  if (!host || !port || !database || !username || !password) {
    throw new PersonalDbError("Connection configuration is invalid. Required: host, port, database, username, password.", { status: 400, code: "invalid_config" });
  }
  return { host, port, database, username, password, sslMode, projectUrl, projectName, anonKey };
}

function sslOption(mode) {
  if (mode === "disable") return false;
  if (mode === "no-verify" || mode === "require-no-verify" || mode === "prefer") return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}

function buildPoolConfig(config) {
  const cfg = {
    host: config.host,
    port: Number(config.port),
    database: config.database,
    user: config.username,
    password: config.password,
    connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS || 5000),
    max: 2,
  };
  const ssl = sslOption(config.sslMode || "no-verify");
  if (ssl !== false) cfg.ssl = ssl;
  return cfg;
}

function configSignature(config) {
  return `${config.host}:${config.port}:${config.database}:${config.username}:${config.sslMode || "no-verify"}`;
}

function getPool(config, userId) {
  const uid = Number(userId);
  const signature = configSignature(config);
  const cached = poolCache.get(uid);
  if (cached && cached.signature === signature && cached.password === config.password) return cached.pool;
  if (cached) cached.pool.end().catch(() => {});
  const pool = new Pool(buildPoolConfig(config));
  pool.on("error", (err) => { console.error("[personal-db] pool error:", safeError(err)); });
  poolCache.set(uid, { pool, signature, password: config.password });
  return pool;
}

function invalidateCache(userId) {
  const uid = Number(userId);
  const cached = poolCache.get(uid);
  if (cached) { cached.pool.end().catch(() => {}); poolCache.delete(uid); }
}

function safeError(err) {
  let msg = (err && err.message) || String(err);
  msg = msg.replace(/postgresql?:\/\/[^\s'"]+/gi, "postgresql://***");
  return msg;
}

function categorizeError(err) {
  const code = err?.code || "";
  const message = err?.message || "";
  if (code === "28P01" || /password authentication failed/i.test(message)) {
    return { status: 401, code: "auth_failed", message: "Authentication failed. Check username and password." };
  }
  if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || /could not connect|connection refused|timeout|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
    return { status: 503, code: "unreachable", message: "Unable to reach the Session Pooler. Check host and port." };
  }
  if (/ssl|certificate|TLS/i.test(message)) {
    return { status: 422, code: "ssl_failed", message: "SSL configuration failed. Adjust SSL mode and retry." };
  }
  if (code === "3D000" || /database .* does not exist/i.test(message)) {
    return { status: 404, code: "db_not_found", message: "Database does not exist. Check database name." };
  }
  return { status: 502, code: "personal_db_error", message: safeError(err) };
}

const REQUIRED_TABLES = ["stores", "customers", "orders", "measurements", "employees", "expenses", "income", "salaries", "shop", "settings"];

async function schemaStatus(pool) {
  const missing = [];
  for (const t of REQUIRED_TABLES) {
    const q = await pool.query("SELECT to_regclass($1) AS reg", [`public.${t}`]);
    if (!q.rows[0] || !q.rows[0].reg) missing.push(t);
  }
  return missing;
}

async function initializeSchema(pool) {
  const files = ["001_initial.sql", "002_garment_measurements_and_suit_quantity.sql", "003_print_settings.sql"];
  for (const f of files) {
    const full = path.join(__dirname, "..", "migrations", f);
    if (!fs.existsSync(full)) continue;
    const sql = fs.readFileSync(full, "utf8");
    await pool.query(sql);
  }
}

async function testConnection(configInput) {
  const config = normalizeConfig(configInput);
  const pool = new Pool(buildPoolConfig(config));
  try {
    const r = await pool.query("SELECT 1 AS ok, current_database() AS db, current_user AS usr");
    const row = r.rows[0] || {};
    let missing = await schemaStatus(pool);
    let initialized = false;
    if (missing.length > 0) {
      await initializeSchema(pool);
      missing = await schemaStatus(pool);
      initialized = true;
    }
    await pool.end().catch(() => {});
    return {
      ok: true,
      database: row.db,
      user: row.usr,
      schema_ok: missing.length === 0,
      missing_tables: missing,
      initialized,
      config,
      error: null,
    };
  } catch (err) {
    await pool.end().catch(() => {});
    const cat = categorizeError(err);
    const e = new PersonalDbError(cat.message, { status: cat.status, code: cat.code });
    e.detail = safeError(err);
    throw e;
  }
}

/** Store initialization for personal databases. */

async function getStores(pool) {
  const result = await pool.query(
    "SELECT id, name, slug, status, created_at, updated_at FROM stores ORDER BY id ASC"
  );
  return result.rows;
}

async function createStore(pool, storeData) {
  const { name, slug } = storeData;
  const result = await pool.query(
    "INSERT INTO stores (name, slug) VALUES ($1, $2) RETURNING id, name, slug, status, created_at",
    [name, slug]
  );
  return result.rows[0];
}

async function getStoreById(pool, storeId) {
  const result = await pool.query(
    "SELECT id, name, slug, status, created_at, updated_at FROM stores WHERE id = $1 LIMIT 1",
    [storeId]
  );
  return result.rows[0] || null;
}

async function initializeStore(pool, userData) {
  const { name, email } = userData || {};
  const storeName = name || "Default Store";
  const slug = (email ? email.split("@")[0] : "default") + "-" + Date.now();
  const store = await createStore(pool, { name: storeName, slug });
  return store;
}

module.exports = {
  PersonalDbError,
  parseConnectionString,
  normalizeConfig,
  buildPoolConfig,
  getPool,
  invalidateCache,
  testConnection,
  initializeSchema,
  schemaStatus,
  safeError,
  categorizeError,
  mask,
  encrypt,
  decrypt,
  getStores,
  createStore,
  getStoreById,
  initializeStore,
  toPersonalDbError,
  run,
};
async function toPersonalDbError(error, operation) {
  const message = error?.message || String(error);
  const code = error?.code || "personal_db_error";
  return { code, message, operation };
}

async function run(client, queryFn, operation) {
  try {
    const result = await queryFn();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: toPersonalDbError(error, operation) };
  }
}

