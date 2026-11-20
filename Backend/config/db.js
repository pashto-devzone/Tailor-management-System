const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { AsyncLocalStorage } = require("async_hooks");

/**
 * Configuration comes from the environment.
 *
 * Values already present in process.env always win, so a hosting platform's
 * dashboard configuration takes precedence and no .env file is required in
 * production. The local Backend/.env is a development convenience, and is also
 * The packaged desktop app must receive production credentials from its
 * runtime environment or a separately provisioned secure configuration.
 */
function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

loadEnvFile();

const isProduction = process.env.NODE_ENV === "production" || process.env.ELECTRON_PRODUCTION === "1";
const dbPath = process.env.TAILOR_DB_PATH
  || path.join(__dirname, "..", "database", "tailor.db");

/**
 * AsyncLocalStorage for per-request user context propagation.
 * This prevents race conditions where concurrent requests
 * could read each other's userId from a shared module-level variable.
 */
const userContextStorage = new AsyncLocalStorage();

/** Set the current user ID for database routing (within current async context). */
exports.setUserContext = (userId) => {
  userContextStorage.enterWith({ userId });
};

/** Get the current user ID from the async context. */
exports.getUserContext = () => {
  const store = userContextStorage.getStore();
  return store ? store.userId : null;
};

/** Check if user has personal Supabase config. */
exports.hasPersonalDb = async () => {
  try {
    const uid = exports.getUserContext();
    if (!uid) return false;
    const model = require("../models/userSupabaseConfigModel");
    return await model.hasPersonalDb(uid);
  } catch {
    return false;
  }
};

/** Get personal Supabase client for current user. */
exports.getPersonalDbClient = async () => {
  if (!await exports.hasPersonalDb()) return null;

  try {
    const uid = exports.getUserContext();
    const model = require("../models/userSupabaseConfigModel");
    const config = await model.getConfigByUserId(uid);
    if (!config || !config.anon_key) return null;
    return require("..").personalDb.getClient(config);
  } catch {
    return null;
  }
};
const migrationPath = path.join(__dirname, "..", "migrations", "001_initial.sql");

let localDb = null;
let SQL = null;
let cloudPool = null;
let cloudOnline = false;
let cloudRecheckTimer = null;

// A single transient pool error (for example the Supabase session pooler
// closing an idle connection) must not latch the backend to "offline" forever.
// After any pool error the connection is re-probed until PostgreSQL answers
// again, so /health recovers on its own instead of silently staying offline.
function scheduleCloudRecheck() {
  if (cloudRecheckTimer) return;
  cloudRecheckTimer = setTimeout(async () => {
    cloudRecheckTimer = null;
    if (!cloudPool) return;
    try {
      await cloudPool.query("SELECT 1");
      cloudOnline = true;
      console.log("[cloud-db] PostgreSQL reachable again: online");
    } catch (error) {
      cloudOnline = false;
      console.error("[cloud-db] still offline:", error.message);
      scheduleCloudRecheck();
    }
  }, 5000);
}

function watchCloudPool() {
  cloudPool.on("error", (error) => {
    cloudOnline = false;
    console.error("[cloud-db] connection error:", error.message);
    scheduleCloudRecheck();
  });
}

function saveDatabase() {
  if (!localDb || !SQL) return;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(localDb.export()));
}

function sqliteMigration() {
  // PostgreSQL and SQLite share the schema used by the models. The only
  // PostgreSQL-only statement is the sequence reset at the end.
  return fs.readFileSync(migrationPath, "utf8")
    .replace(/SELECT setval\([\s\S]*?\);\s*$/i, "");
}

async function ensurePersonalDbMigrations() {
  for (const name of ["004_user_supabase_configs.sql", "005_personal_store_id.sql", "007_central_keepalive_status.sql"]) {
    try {
      const sql = fs.readFileSync(path.join(__dirname, "..", "migrations", name), "utf8");
      await cloudPool.query(sql);
      console.log(`[database] verified ${name}`);
    } catch (error) {
      console.warn(
        `[database] could not apply ${name}; accounts will use the central database until it is fixed:`,
        error.message,
      );
    }
  }
}

function rows(result) {
  if (!result || !result.length) return [];
  const [table] = result;
  return table.values.map((values) =>
    Object.fromEntries(table.columns.map((column, index) => [column, values[index]])),
  );
}

function localPrepare(sql) {
  return {
    run(...params) {
      if (!localDb) throw new Error("Local database not initialized");
      const returningResult = /\bRETURNING\b/i.test(sql)
        ? localDb.exec(sql, params)
        : null;
      if (!returningResult) localDb.run(sql, params);
      const changes = localDb.getRowsModified();
      const returnedRow = returningResult?.[0]?.values?.[0];
      const returnedId = returningResult?.[0]?.columns
        ? returnedRow?.[returningResult[0].columns.indexOf("id")]
        : undefined;
      const result = returnedId == null ? localDb.exec("SELECT last_insert_rowid() AS id") : null;
      const lastInsertRowid = returnedId ?? result?.[0]?.values?.[0]?.[0];
      saveDatabase();
      return { changes, lastInsertRowid };
    },
    get(...params) {
      if (!localDb) throw new Error("Local database not initialized");
      return rows(localDb.exec(sql, params))[0] || null;
    },
    all(...params) {
      if (!localDb) throw new Error("Local database not initialized");
      return rows(localDb.exec(sql, params));
    },
  };
}

function cloudPrepare(sql) {
  let index = 0;
  const statement = sql.replace(/\?/g, () => `$${++index}`);
  return {
    async run(...params) {
      const result = await cloudPool.query(statement, params);
      return {
        changes: result.rowCount,
        lastInsertRowid: result.rows[0]?.id == null ? undefined : Number(result.rows[0].id),
      };
    },
    async get(...params) {
      const result = await cloudPool.query(statement, params);
      return result.rows[0] || null;
    },
    async all(...params) {
      const result = await cloudPool.query(statement, params);
      return result.rows;
    },
  };
}

function prepare(sql) {
  if (cloudPool && cloudOnline) {
    return cloudPrepare(sql);
  }
  if (localDb) {
    return localPrepare(sql);
  }
  if (cloudPool) {
    return cloudPrepare(sql);
  }
  throw new Error("Database is unavailable");
}

// Existing local databases predate columns added later to 001_initial.sql
// (CREATE TABLE IF NOT EXISTS never alters an existing table). This guarded,
// idempotent step keeps the development SQLite database in sync with the
// canonical schema. Production PostgreSQL uses numbered migrations; startup
// additionally ensures the personal-database migrations are applied.
function ensureLocalColumn(dbHandle, table, column, ddlType) {
  try {
    const info = dbHandle.exec(`PRAGMA table_info(${table})`);
    const columns = (info && info[0] && info[0].values ? info[0].values : []).map((row) => row[1]);
    if (!columns.includes(column)) {
      dbHandle.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`);
      console.log(`[database] added ${table}.${column} to the local database`);
    }
  } catch (error) {
    console.warn(`[database] could not ensure ${table}.${column}:`, error.message);
  }
}

async function initialize() {
  if (localDb) return;

  // PostgreSQL/Supabase is the production database. If DATABASE_URL is absent
  // but the individual components are set, rebuild the connection string so the
  // password is never embedded in a single env var. DATABASE_URL always wins.
  if (!process.env.DATABASE_URL) {
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;
    if (host && port && user && password && database) {
      process.env.DATABASE_URL =
        `postgresql://${user}:${password}@${host}:${port}/${database}`;
    }
  }

  // Production requires PostgreSQL/Supabase. SQLite is never initialized here:
  // the backend fails fast when DATABASE_URL is missing rather than silently
  // serving a stale local database with a different schema.
  if (isProduction) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is required for production desktop builds. " +
        "The backend cannot start without a PostgreSQL/Supabase connection."
      );
    }
    const newPool = !cloudPool;
    if (newPool) cloudPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: "-c client_encoding=UTF8",
      connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS || 3000),
      max: Number(process.env.PGPOOL_MAX || 5),
    });
    if (newPool) watchCloudPool();
    await cloudPool.query("SELECT 1");
    cloudOnline = true;
    console.log("[database] PostgreSQL/Supabase connection established");
    await ensurePersonalDbMigrations();
    return;
  }

  // Development mode: attempt cloud first, fall back to local SQLite.
  if (process.env.DATABASE_URL) {
    try {
      cloudPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        options: "-c client_encoding=UTF8",
        connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS || 3000),
        max: Number(process.env.PGPOOL_MAX || 5),
      });
      watchCloudPool();
      await cloudPool.query("SELECT 1");
      cloudOnline = true;
      console.log("[database] PostgreSQL/Supabase connection established");
      await ensurePersonalDbMigrations();
      return;
    } catch (error) {
      cloudOnline = false;
      if (cloudPool) await cloudPool.end().catch(() => {});
      cloudPool = null;
      console.warn("[cloud-db] unavailable; falling back to local SQLite:", error.message);
    }
  }

  // Local development only: an in-process SQLite database (sql.js) persisted to
  // Backend/database/tailor.db. Production never reaches this branch.
  const initSqlJs = require("sql.js");
  SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });
  const existing = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;
  localDb = new SQL.Database(existing);
  localDb.run("PRAGMA foreign_keys = ON");
  localDb.run(sqliteMigration());
  ensureLocalColumn(localDb, "settings", "printsettings", "TEXT");
  saveDatabase();
  console.log("[database] local SQLite initialized");
}

async function close() {
  saveDatabase();
  if (cloudRecheckTimer) {
    clearTimeout(cloudRecheckTimer);
    cloudRecheckTimer = null;
  }
  if (cloudPool) await cloudPool.end().catch(() => {});
  cloudPool = null;
  cloudOnline = false;
  localDb = null;
  SQL = null;
}

// Personal database recovery is deliberately per-user; it never changes the
// central pool's online state and never routes a personal account to central.
const personalRecoveryTimers = new Map();
function schedulePersonalRecovery(uid, cfg) {
  if (personalRecoveryTimers.has(String(uid))) return;
  const startedAt = Date.now();
  const attempt = async () => {
    const age = Date.now() - startedAt;
    try {
      const personalDb = require("../services/personalDb");
      personalDb.invalidateCache(uid);
      const pool = personalDb.getPool(cfg, uid);
      await pool.query("SELECT 1");
      personalRecoveryTimers.delete(String(uid));
      personalRetryAfter.delete(String(uid));
      console.log(`[personal-db] recovery succeeded for user ${uid}`);
      return;
    } catch (err) {
      console.warn(`[personal-db] recovery attempt for user ${uid} failed (${err.code || "unknown"})`);
    }
    const delay = age < 15 * 60 * 1000 ? 20_000 : 60_000;
    const timer = setTimeout(attempt, delay);
    timer.unref?.();
    personalRecoveryTimers.set(String(uid), timer);
  };
  const timer = setTimeout(attempt, 20_000);
  timer.unref?.();
  personalRecoveryTimers.set(String(uid), timer);
}

exports.getUserContext = () => {
  const store = userContextStorage.getStore();
  return store ? store.userId : null;
};

function publicDatabaseError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = true;
  return error;
}

const PERSONAL_DB_MESSAGE = "Your Supabase database is not reachable yet. If you just resumed it, wait a few minutes and press Retry.";
function friendlyPersonalFailure(err) {
  try {
    const result = require("../services/personalDb").categorizeError(err);
    return publicDatabaseError(result.message, 503, `personal_db_${result.code}`);
  } catch (_) {
    return publicDatabaseError(PERSONAL_DB_MESSAGE, 503, "personal_db_unavailable");
  }
}
const personalStoreCache = new Map();
const personalRetryAfter = new Map();
const personalStoreCacheMs = 3 * 60 * 1000;

function isPersonalConnectionError(err) {
  return /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|57P01|terminating connection|connection terminated|tenant or user not found|pooler|startup|authentication/i.test(`${err?.code || ""} ${err?.message || ""}`);
}

async function resolvePersonalStore(pool, uid) {
  const cached = personalStoreCache.get(String(uid));
  if (cached && cached.expiresAt > Date.now()) return cached.store;
  const model = require("../models/userSupabaseConfigModel");
  const user = await prepare("SELECT id, name, email, personal_store_id FROM users WHERE id = ? LIMIT 1").get(uid);
  let store = user?.personal_store_id ? await require("../services/personalDb").getStoreById(pool, user.personal_store_id) : null;
  if (!store) {
    const stores = await require("../services/personalDb").getStores(pool);
    store = stores[0] || null;
    if (store) await model.setPersonalStoreId(uid, store.id);
  }
  if (!store) throw new Error("No store is available in your personal database.");
  personalStoreCache.set(String(uid), { store, expiresAt: Date.now() + personalStoreCacheMs });
  return store;
}

async function getPersonalOperational(uid, cfg) {
  const personalDb = require("../services/personalDb");
  if ((personalRetryAfter.get(String(uid)) || 0) > Date.now()) {
    throw publicDatabaseError(PERSONAL_DB_MESSAGE, 503, "personal_db_unavailable");
  }
  let pool = personalDb.getPool(cfg, uid);
  try {
    const store = await resolvePersonalStore(pool, uid);
    return { pool, personal: true, uid, cfg, storeId: store.id };
  } catch (err) {
    if (!isPersonalConnectionError(err)) throw err;
    schedulePersonalRecovery(uid, cfg);
    personalDb.invalidateCache(uid);
    personalStoreCache.delete(String(uid));
    personalRetryAfter.set(String(uid), Date.now() + 3000);
    pool = personalDb.getPool(cfg, uid);
    try {
      const store = await resolvePersonalStore(pool, uid);
      return { pool, personal: true, uid, cfg, storeId: store.id };
    } catch (retryError) {
      if (isPersonalConnectionError(retryError)) personalDb.invalidateCache(uid);
      schedulePersonalRecovery(uid, cfg);
      throw friendlyPersonalFailure(retryError);
    }
  }
}

async function resolveOperationalPool() {
  const uid = exports.getUserContext();
  if (uid) {
    let model;
    let hasPersonalDb;
    try {
      model = require("../models/userSupabaseConfigModel");
      hasPersonalDb = await model.hasPersonalDb(uid);
    } catch (err) {
      console.error("[db] personal database status lookup failed:", err.message);
      throw publicDatabaseError("Unable to verify your account database configuration. Please try again.", 500, "personal_db_config_error");
    }

    if (hasPersonalDb) {
      let config;
      try {
        config = await model.getConfigByUserId(uid);
      } catch (err) {
        console.error("[db] personal database configuration lookup failed:", err.message);
        throw publicDatabaseError(
          PERSONAL_DB_MESSAGE,
          503,
          "personal_db_config_error",
        );
      }
      if (!config || !config.connection_host || !config.encrypted_password) {
        throw publicDatabaseError(
          "Your personal database configuration is incomplete. Reconnect it in Settings.",
          503,
          "personal_db_unavailable",
        );
      }
      try {
        const personalDb = require("../services/personalDb");
        const { decrypt } = require("../helpers/encryption");
        const cfg = {
          host: config.connection_host,
          port: config.connection_port,
          database: config.connection_database,
          username: config.connection_username,
          password: decrypt(config.encrypted_password),
          sslMode: config.ssl_mode || "no-verify",
        };
        return await getPersonalOperational(uid, cfg);
      } catch (err) {
        console.warn("[db] personal pool resolution failed:", err.message);
        const decryptionFailed = /ENCRYPTION_KEY|decrypt|encrypted credential/i.test(err.message || "");
        throw publicDatabaseError(
          decryptionFailed
          ? "Your personal database configuration could not be decrypted. Verify ENCRYPTION_KEY or reconnect it in Settings."
            : PERSONAL_DB_MESSAGE,
          503,
          "personal_db_unavailable",
        );
      }
    }
  }
  return { pool: cloudPool, personal: false };
}

exports.getOperationalPool = async () => (await resolveOperationalPool()).pool;
exports.resolveOperationalStore = async () => {
  const operational = await resolveOperationalPool();
  return operational.personal ? operational.storeId : null;
};
exports.resetPersonalDbRetry = (userId) => {
  personalRetryAfter.delete(String(userId));
  personalStoreCache.delete(String(userId));
};

function operationalPrepare(sql) {
  let index = 0;
  const statement = sql.replace(/\?/g, () => `$${++index}`);
  const centralTables = "users|sessions|password_reset_tokens|user_supabase_configs|stores|admin_users|admin_sessions|admin_activity|admin_activity_log|licenses|license_events|update_events|api_keys|api_key_scopes";
  const centralOnly = new RegExp(`\\b(?:FROM|JOIN|INTO|UPDATE|DELETE\\s+FROM)\\s+(?:public\\.)?(?:${centralTables})\\b`, "i").test(sql);
  async function resolve() {
    const operational = await resolveOperationalPool();
    if (operational.pool) return { type: "pg", pool: operational.pool, personal: operational.personal };
    if (localDb) return { type: "local" };
    throw new Error("Operational database is unavailable");
  }
  async function query(pool, personal, params, uid, cfg) {
    try {
      return await pool.query(statement, params);
    } catch (err) {
      if (!personal) throw err;
      if (!isPersonalConnectionError(err)) throw err;
      const personalDb = require("../services/personalDb");
      personalDb.invalidateCache(uid);
      personalStoreCache.delete(String(uid));
      personalRetryAfter.set(String(uid), Date.now() + 3000);
      try {
        const fresh = personalDb.getPool(cfg, uid);
        await resolvePersonalStore(fresh, uid);
        return await fresh.query(statement, params);
      } catch (retryError) {
        if (isPersonalConnectionError(retryError)) personalDb.invalidateCache(uid);
        schedulePersonalRecovery(uid, cfg);
        throw friendlyPersonalFailure(retryError);
      }
    }
  }
  return {
    async run(...params) {
      if (centralOnly) return prepare(sql).run(...params);
      const r = await resolve();
      if (r.type === "local") return localPrepare(sql).run(...params);
      const result = await query(r.pool, r.personal, params, r.uid, r.cfg);
      return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id == null ? undefined : Number(result.rows[0].id) };
    },
    async get(...params) {
      if (centralOnly) return prepare(sql).get(...params);
      const r = await resolve();
      if (r.type === "local") return localPrepare(sql).get(...params);
      const result = await query(r.pool, r.personal, params, r.uid, r.cfg);
      return result.rows[0] || null;
    },
    async all(...params) {
      if (centralOnly) return prepare(sql).all(...params);
      const r = await resolve();
      if (r.type === "local") return localPrepare(sql).all(...params);
      const result = await query(r.pool, r.personal, params, r.uid, r.cfg);
      return result.rows;
    },
  };
}

exports.prepareOperational = operationalPrepare;

// Auth, account configuration, and administration data always belong to the
// central database, regardless of the request's operational user context.
const central = { prepare, get: (sql, params = []) => prepare(sql).get(...params), all: (sql, params = []) => prepare(sql).all(...params), run: (sql, params = []) => prepare(sql).run(...params) };

module.exports = {
  initialize,
  close,
  setUserContext: exports.setUserContext,
  getUserContext: exports.getUserContext,
  getOperationalPool: exports.getOperationalPool,
  resolveOperationalStore: exports.resolveOperationalStore,
  resetPersonalDbRetry: exports.resetPersonalDbRetry,
  prepare,
  central,
  prepareOperational: exports.prepareOperational,
  get: (sql, params = []) => prepare(sql).get(...params),
  all: (sql, params = []) => prepare(sql).all(...params),
  run: (sql, params = []) => prepare(sql).run(...params),
  exec: (sql) => {
    if (!localDb) throw new Error("Local database not initialized");
    const result = localDb.exec(sql);
    saveDatabase();
    return result;
  },
  query: async (sql, params = []) => {
    if (!cloudPool) throw new Error("Cloud database is unavailable");
    return cloudPool.query(sql, params);
  },
  get cloudOnline() {
    return cloudOnline;
  },
  get pool() {
    return cloudPool;
  },
};


