"use strict";
const assert = require("assert");
const Module = require("module");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { EventEmitter } = require("events");

process.env.NODE_ENV = "production";
process.env.DATABASE_URL = "postgres://central.test/central";
process.env.JWT_SECRET = "personal-db-recovery-test-secret";
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.PGCONNECT_TIMEOUT_MS = "100";

const userRows = new Map();
const configRows = new Map();
const sessions = new Map();
const sqlSeen = [];
const centralSqlSeen = [];
const personalSqlSeen = [];
let personalFails = 100;
let personalPoolCount = 0;
let customerCentralReads = 0;

class MockPool extends EventEmitter {
  constructor(config) { super(); this.config = config; this.personal = config.host === "personal.test"; if (this.personal) personalPoolCount++; }
  async query(sql, params = []) {
    sqlSeen.push(sql);
    (this.personal ? personalSqlSeen : centralSqlSeen).push(sql);
    if (this.personal) {
      if (personalFails > 0) { personalFails--; const tenantFailure = personalFails % 2 === 0; const e = new Error(tenantFailure ? "Tenant or user not found" : "connect ECONNREFUSED personal.test"); e.code = tenantFailure ? "57P01" : "ECONNREFUSED"; throw e; }
      if (/FROM stores/i.test(sql)) return { rows: [{ id: 77, name: "Personal Shop", slug: "personal-shop", status: "active" }], rowCount: 1 };
      if (/to_regclass/i.test(sql)) return { rows: [{ reg: "public.table" }], rowCount: 1 };
      if (/FROM customers/i.test(sql)) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    }
    if (/^SELECT 1/i.test(sql)) return { rows: [{ ok: 1 }], rowCount: 1 };
    if (/FROM users/i.test(sql)) {
      let user = params[0] != null ? userRows.get(String(params[0])) : null;
      if (!user && params[0]) user = [...userRows.values()].find(x => x.email === params[0]);
      if (/has_personal_db/i.test(sql) && /SELECT has_personal_db/i.test(sql)) user = user && { has_personal_db: user.has_personal_db, personal_store_id: user.personal_store_id };
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }
    if (/FROM user_supabase_configs/i.test(sql)) {
      const row = configRows.get(String(params[0]));
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (/FROM sessions/i.test(sql)) {
      const row = sessions.get(params[0]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (/INSERT INTO sessions/i.test(sql)) {
      sessions.set(params[2], { id: params[0], user_id: params[1], token: params[2], expires_at: params[3] });
      return { rows: [], rowCount: 1 };
    }
    if (/DELETE FROM sessions/i.test(sql)) { sessions.delete(params[0]); return { rows: [], rowCount: 1 }; }
    if (/UPDATE users SET personal_store_id/i.test(sql)) { const u = userRows.get(String(params[1])); if (u) u.personal_store_id = params[0]; return { rows: [], rowCount: 1 }; }
    if (/UPDATE users SET has_personal_db/i.test(sql)) { const u = userRows.get(String(params[0])); if (u) u.has_personal_db = true; return { rows: [], rowCount: 1 }; }
    if (/customers/i.test(sql)) customerCentralReads++;
    return { rows: [], rowCount: 1 };
  }
  async end() {}
}
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "pg") return { Pool: MockPool };
  return originalLoad.call(this, request, parent, isMain);
};

const db = require("../config/db");
const encryption = require("../helpers/encryption");
const auth = require("../middlewares/auth");
const authController = require("../controllers/authController");
const configController = require("../controllers/userSupabaseConfigController");
const personalDb = require("../services/personalDb");
const operationalDb = require("../config/operationalDb");

function response() {
  return { statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
}
async function authenticateRequest(token) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = response();
  let nextCalled = false;
  await auth.authenticate(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

(async () => {
  const passwordHash = await bcrypt.hash("password123", 4);
  userRows.set("1", { id: 1, store_id: 10, personal_store_id: 77, has_personal_db: true, role: "owner", name: "Personal", email: "p@example.test", password_hash: passwordHash });
  userRows.set("2", { id: 2, store_id: 20, personal_store_id: null, has_personal_db: false, role: "owner", name: "Central", email: "c@example.test", password_hash: passwordHash });
  userRows.set("3", { id: 3, store_id: 30, personal_store_id: null, has_personal_db: false, role: "owner", name: "Skip", email: "s@example.test", password_hash: passwordHash });
  configRows.set("1", { user_id: 1, connection_host: "personal.test", connection_port: 5432, connection_database: "postgres", connection_username: "postgres", encrypted_password: encryption.encrypt("secret"), password_masked: "••••cret", ssl_mode: "disable", status: "verified", schema_ok: true, schema_checked: true });
  await db.initialize();

  const loginRes = response();
  await authController.login({ body: { email: "p@example.test", password: "password123" }, ip: "test" }, loginRes);
  assert.equal(loginRes.statusCode, 200, "personal user login succeeds while personal pool is failing");
  const token = loginRes.body.token;
  const authResult = await authenticateRequest(token);
  assert.equal(authResult.nextCalled, true, "authentication succeeds without opening personal pool");
  assert.equal(authResult.req.storeId, 77);
  const configRes = response();
  await configController.getConfig({ user: { id: 1 } }, configRes);
  assert.equal(configRes.statusCode, 200, "GET config stays central-only");
  assert.equal(configRes.body.has_personal_db, true);

  db.setUserContext(1);
  const businessRes = response();
  await operationalDb.prepare("SELECT * FROM customers WHERE store_id = ?").all(77).catch(err => { businessRes.statusCode = err.status; businessRes.body = { code: err.code, message: err.message }; });
  assert.equal(businessRes.statusCode, 503, "personal business query returns 503 during outage");
  assert.match(businessRes.body.message, /Your Supabase database is not reachable yet/);
  assert.equal(customerCentralReads, 0, "business query never falls back to central business tables");

  for (const id of [2, 3]) {
    db.setUserContext(id);
    await operationalDb.prepare("SELECT * FROM customers WHERE store_id = ?").all(userRows.get(String(id)).store_id);
  }
  assert.equal(customerCentralReads, 2, "central and skip users remain unaffected");

  await operationalDb.prepare("SELECT * FROM users WHERE id = ?").get(1);
  assert(centralSqlSeen.some(sql => /FROM users/i.test(sql)) && centralSqlSeen.some(sql => /FROM sessions/i.test(sql)) && centralSqlSeen.some(sql => /FROM user_supabase_configs/i.test(sql)), "auth/config central tables were queried through central pool");
  assert(!personalSqlSeen.some(sql => /FROM users|FROM sessions|FROM user_supabase_configs/i.test(sql)), "central table SQL never reaches personal pool");
  assert(personalPoolCount >= 2, "failed personal pool was evicted and recreated for one retry");

  await new Promise(resolve => setTimeout(resolve, 3100));
  personalFails = 0;
  db.setUserContext(1);
  const recovered = await operationalDb.prepare("SELECT * FROM customers WHERE store_id = ?").all(77);
  assert.deepEqual(recovered, [], "business query recovers after cooldown without process restart");
  assert(personalPoolCount >= 3, "recovery created a fresh pool after stale pool eviction");

  personalDb.invalidateCache(1);
  const reconnectRes = response();
  await configController.reconnect({ user: { id: 1 } }, reconnectRes);
  assert.equal(reconnectRes.statusCode, 200);
  assert.equal(reconnectRes.body.ok, true, "reconnect endpoint succeeds with saved decrypted config");
  assert(!JSON.stringify(reconnectRes.body).includes("secret"), "reconnect never returns password");

  assert(centralSqlSeen.filter(sql => /FROM users|FROM sessions|FROM user_supabase_configs/i.test(sql)).length >= 3, "central auth/config tables remain central while personal context is set");
  console.log("PASS login succeeds while personal database is down");
  console.log("PASS authenticate and GET /api/user/supabase-config use the central database");
  console.log("PASS business data returns friendly 503 without central fallback");
  console.log("PASS central and skip users remain unaffected");
  console.log("PASS stale pool is evicted and request recovers after cooldown");
  console.log("PASS reconnect endpoint succeeds without exposing credentials");
  await db.close();
})().catch(async err => { console.error(err); await db.close().catch(() => {}); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; });



