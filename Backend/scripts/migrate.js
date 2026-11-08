/**
 * Idempotent migration runner for the central PostgreSQL database.
 *
 * Usage:
 *   node scripts/migrate.js            # apply every pending migration
 *   node scripts/migrate.js --status   # list applied / pending migrations
 *
 * Applied migrations are recorded in the `schema_migrations` table so a
 * migration file is never executed twice. Every migration in this folder is
 * written to be re-runnable on its own, but the tracking table keeps the
 * process deterministic.
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Load Backend/.env exactly like config/db.js does.
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match || match[1] in process.env) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const migrationsDir = path.join(__dirname, "..", "migrations");

function listMigrations() {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

async function ensureTrackingTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function appliedMigrations(pool) {
  const { rows } = await pool.query("SELECT name FROM schema_migrations");
  return new Set(rows.map((row) => row.name));
}

async function main() {
  const statusOnly = process.argv.includes("--status");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    max: 1,
  });

  try {
    await ensureTrackingTable(pool);
    const applied = await appliedMigrations(pool);
    const migrations = listMigrations();

    if (statusOnly) {
      for (const name of migrations) {
        console.log(`${applied.has(name) ? "[applied]" : "[pending]"} ${name}`);
      }
      return;
    }

    for (const name of migrations) {
      if (applied.has(name)) {
        console.log(`[skip] ${name}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, name), "utf8");
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      console.log(`[applied] ${name}`);
    }
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
