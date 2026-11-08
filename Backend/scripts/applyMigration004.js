const fs = require("fs");
const path = require("path");
const db = require("../config/db");
(async () => {
  await db.initialize();
  const sql = fs.readFileSync(path.join(__dirname, "..", "migrations", "004_user_supabase_configs.sql"), "utf8");
  await db.query(sql);
  console.log("Migration 004 applied.");
  await db.close();
})().catch((e) => { console.error(e); process.exit(1); });
