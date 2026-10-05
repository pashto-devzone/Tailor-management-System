/**
 * Read-only diagnostic for the Supabase Session Pooler connection.
 *
 * Usage:  node scripts/testCloudDb.js
 *
 * - Loads Backend/.env exactly like config/db.js does.
 * - Tests the CURRENT DATABASE_URL as-is (baseline).
 * - If it fails and no sslmode is set, tests again with ?sslmode=require
 *   (Supabase pooler requires TLS; node-postgres defaults to no SSL).
 * - Runs a read-only query against an existing application table to prove
 *   the cloud database is actually usable.
 *
 * NEVER prints credentials: any error message is redacted before logging.
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

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

const redact = (value) =>
  String(value || "")
    .replace(/\/\/[^:@/\s]+:[^@/\s]+@/, "//***MASKED***@")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://***MASKED***");

async function test(label, connStr) {
  const started = Date.now();
  const pool = new Pool({
    connectionString: connStr,
    connectionTimeoutMillis: 8000,
    max: 1,
  });
  try {
    await pool.query("SELECT 1 AS ok");
    const elapsed = Date.now() - started;
    console.log(`[${label}] CONNECT: OK (SELECT 1 succeeded in ${elapsed}ms)`);

    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log(
      `[${label}] public tables (${tables.rows.length}): ` +
        tables.rows.map((r) => r.table_name).join(", ")
    );

    if (tables.rows.some((r) => r.table_name === "users")) {
      const users = await pool.query(
        "SELECT count(*)::int AS n FROM users"
      );
      console.log(`[${label}] READ-ONLY QUERY: SELECT count(*) FROM users -> ${users.rows[0].n}`);
    } else {
      console.log(`[${label}] WARNING: application table "users" does NOT exist in cloud DB`);
    }
    return true;
  } catch (error) {
    console.log(`[${label}] FAIL: code=${error.code || "-"} message=${redact(error.message)}`);
    return false;
  } finally {
    await pool.end().catch(() => {});
  }
}

(async () => {
  const current = process.env.DATABASE_URL;
  if (!current) {
    console.log("FAIL: DATABASE_URL is not set in Backend/.env");
    process.exit(1);
  }
  console.log(
    "DATABASE_URL host=" +
      redact(current).replace(/^postgresql:\/\//, "").split("@").pop()
  );

  const okCurrent = await test("CURRENT_URL", current);

  // `--ssl` forces the sslmode=require variant even if the current URL works,
  // so we can verify TLS compatibility before changing Backend/.env.
  if (process.argv.includes("--ssl") && !/[?&]sslmode=/.test(current)) {
    const withSsl = `${current}?sslmode=require`;
    const okSsl = await test("URL_PLUS_sslmode_require", withSsl);
    process.exit(okSsl ? 0 : 2);
  }

  // `--ssl-noverify` tests TLS with certificate verification disabled
  // (Supabase pooler uses a self-signed chain; sslmode=require alone fails
  // with SELF_SIGNED_CERT_IN_CHAIN under Node's default verification).
  if (process.argv.includes("--ssl-noverify") && !/[?&]sslmode=/.test(current)) {
    const withSsl = `${current}?sslmode=no-verify`;
    const okSsl = await test("URL_PLUS_sslmode_no_verify", withSsl);
    process.exit(okSsl ? 0 : 2);
  }

  if (!okCurrent && !/[?&]sslmode=/.test(current)) {
    const withSsl = `${current}?sslmode=require`;
    const okSsl = await test("URL_PLUS_sslmode_require", withSsl);
    console.log(okSsl
      ? "CONCLUSION: appending ?sslmode=require FIXES the cloud connection."
      : "CONCLUSION: sslmode=require did NOT fix the cloud connection.");
    process.exit(okSsl ? 0 : 2);
  }

  process.exit(okCurrent ? 0 : 2);
})();
