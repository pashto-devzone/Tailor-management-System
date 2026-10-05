const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

/**
 * Configuration comes from the environment.
 *
 * Values already present in process.env always win, so a hosting platform's
 * dashboard configuration takes precedence and no .env file is required in
 * production. The local Backend/.env is a development convenience, and is also
 * what the packaged desktop app ships with.
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
  // Once a cloud pool exists it stays authoritative: routing queries to the
  // local SQLite handle after a transient cloud error would fail anyway
  // (localDb is never initialized in that mode) and would hide real
  // PostgreSQL failures from /health and from every API route.
  if (cloudPool) {
    return cloudPrepare(sql);
  }
  return localPrepare(sql);
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
    cloudPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS || 3000),
      max: Number(process.env.PGPOOL_MAX || 5),
    });
    watchCloudPool();
    await cloudPool.query("SELECT 1");
    cloudOnline = true;
    console.log("[database] PostgreSQL/Supabase connection established");
    return;
  }

  // Development mode: attempt cloud first, fall back to local SQLite.
  if (process.env.DATABASE_URL) {
    try {
      cloudPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS || 3000),
        max: Number(process.env.PGPOOL_MAX || 5),
      });
      watchCloudPool();
      await cloudPool.query("SELECT 1");
      cloudOnline = true;
      console.log("[database] PostgreSQL/Supabase connection established");
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

module.exports = {
  initialize,
  close,
  prepare,
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
