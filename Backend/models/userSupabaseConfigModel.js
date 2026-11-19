"use strict";
const db = require("../config/db");
const { encrypt, decrypt, mask } = require("../helpers/encryption");
const isMissingPersonalDbSchemaError = (error) =>
  ["42P01", "42703"].includes(error?.code) ||
  /no such (?:table|column)|(?:table|column) .+ does not exist/i.test(error?.message || "");

exports.isMissingPersonalDbSchemaError = isMissingPersonalDbSchemaError;

exports.getConfigByUserId = async (userId) => {
  const row = await db.prepare(
    `SELECT id, user_id, connection_host, connection_port, connection_database, connection_username,
            encrypted_password, password_masked, ssl_mode, project_url, project_name,
            encrypted_anon_key, anon_key_masked, status, schema_checked, schema_ok,
            last_tested_at, last_test_error, created_at, updated_at
     FROM user_supabase_configs WHERE user_id = ? LIMIT 1`
  ).get(userId);
  if (!row) return null;
  let password = null;
  let anonKey = null;
  let decryptionError = false;
  try { password = row.encrypted_password ? decrypt(row.encrypted_password) : null; } catch (e) { decryptionError = true; }
  try { anonKey = row.encrypted_anon_key ? decrypt(row.encrypted_anon_key) : null; } catch (e) { decryptionError = true; }
  return {
    ...row,
    password,
    anon_key: anonKey,
    decryption_error: decryptionError,
  };
};
exports.getPublicConfigByUserId = async (userId) => {
  const row = await db.prepare(
    `SELECT id, user_id, connection_host, connection_port, connection_database, connection_username,
            password_masked, ssl_mode, project_url, project_name, anon_key_masked,
            status, schema_checked, schema_ok, last_tested_at, last_test_error,
            created_at, updated_at
     FROM user_supabase_configs WHERE user_id = ? LIMIT 1`
  ).get(userId);
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    connection_host: row.connection_host,
    connection_port: row.connection_port,
    connection_database: row.connection_database,
    connection_username: row.connection_username,
    password_masked: row.password_masked,
    ssl_mode: row.ssl_mode,
    project_url: row.project_url,
    project_name: row.project_name,
    anon_key_masked: row.anon_key_masked,
    status: row.status,
    schema_checked: Boolean(row.schema_checked),
    schema_ok: Boolean(row.schema_ok),
    last_tested_at: row.last_tested_at,
    last_test_error: row.last_test_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};
exports.hasPersonalDb = async (userId) => {
  try {
    const user = await db.prepare(
      "SELECT has_personal_db, personal_store_id FROM users WHERE id = ? LIMIT 1",
    ).get(userId);
    if (!user || !(user.has_personal_db === true || user.has_personal_db === 1)) return false;

    const config = await db.prepare(
      `SELECT connection_host, connection_port, connection_database, connection_username,
              encrypted_password, status, schema_ok
       FROM user_supabase_configs WHERE user_id = ? LIMIT 1`,
    ).get(userId);
    return Boolean(
      config &&
      config.status === "verified" &&
      (config.schema_ok === true || config.schema_ok === 1) &&
      config.connection_host &&
      config.connection_port &&
      config.connection_database &&
      config.connection_username &&
      config.encrypted_password,
    );
  } catch (error) {
    if (!isMissingPersonalDbSchemaError(error)) throw error;
    console.warn("[personal-db] migration 004/005 schema is unavailable; using the central database.");
    return false;
  }
};
exports.upsertConfig = async (values) => {
  const {
    userId,
    host,
    port,
    database,
    username,
    password,
    sslMode = "no-verify",
    projectUrl = null,
    projectName = null,
    anonKey = null,
    status = "pending",
    schemaOk = false,
  } = values || {};
  if (!userId || !host || !port || !database || !username || !password) {
    throw new Error("userId, host, port, database, username and password are required.");
  }
  const encryptedPassword = encrypt(password);
  const maskedPassword = mask(password);
  const encryptedAnon = anonKey ? encrypt(anonKey) : null;
  const maskedAnon = anonKey ? mask(anonKey) : null;
  const existing = await db.prepare("SELECT id FROM user_supabase_configs WHERE user_id = ? LIMIT 1").get(userId);
  if (existing) {
    await db.prepare(
      `UPDATE user_supabase_configs
       SET connection_host = ?, connection_port = ?, connection_database = ?, connection_username = ?,
           encrypted_password = ?, password_masked = ?, ssl_mode = ?,
           project_url = ?, project_name = ?,
           encrypted_anon_key = COALESCE(?, encrypted_anon_key),
           anon_key_masked = COALESCE(?, anon_key_masked),
           status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`
    ).run(
      host, Number(port), database, username,
      encryptedPassword, maskedPassword, sslMode,
      projectUrl, projectName,
      encryptedAnon, maskedAnon,
      status, userId
    );
  } else {
    await db.prepare(
      `INSERT INTO user_supabase_configs
        (user_id, connection_host, connection_port, connection_database, connection_username,
         encrypted_password, password_masked, ssl_mode, project_url, project_name,
         encrypted_anon_key, anon_key_masked, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId, host, Number(port), database, username,
      encryptedPassword, maskedPassword, sslMode, projectUrl, projectName,
      encryptedAnon, maskedAnon, status
    );
  }
  if (schemaOk === true) {
    await db.prepare("UPDATE users SET has_personal_db = TRUE WHERE id = ?").run(userId);
  } else {
    await db.prepare("UPDATE users SET has_personal_db = FALSE WHERE id = ?").run(userId);
  }
  await db.prepare(
    `UPDATE user_supabase_configs SET schema_ok = ?, schema_checked = TRUE, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
  ).run(schemaOk ? 1 : 0, userId);
  return exports.getPublicConfigByUserId(userId);
};
exports.updateStatus = async (userId, status, testError = null, schemaChecked = null, schemaOk = null) => {
  const fields = ["status = ?", "updated_at = CURRENT_TIMESTAMP"];
  const params = [status];
  if (testError !== null) { fields.push("last_test_error = ?"); params.push(testError); }
  else { fields.push("last_test_error = NULL"); }
  fields.push("last_tested_at = CURRENT_TIMESTAMP");
  if (schemaChecked !== null) { fields.push("schema_checked = ?"); params.push(schemaChecked); }
  if (schemaOk !== null) { fields.push("schema_ok = ?"); params.push(schemaOk); }
  params.push(userId);
  await db.prepare(`UPDATE user_supabase_configs SET ${fields.join(", ")} WHERE user_id = ?`).run(...params);
  if (schemaOk === true) await db.prepare("UPDATE users SET has_personal_db = TRUE WHERE id = ?").run(userId);
  else if (schemaOk === false) await db.prepare("UPDATE users SET has_personal_db = FALSE WHERE id = ?").run(userId);
  return exports.getPublicConfigByUserId(userId);
};
exports.removeConfig = async (userId) => {
  await db.prepare("DELETE FROM user_supabase_configs WHERE user_id = ?").run(userId);
  await db.prepare("UPDATE users SET has_personal_db = FALSE WHERE id = ?").run(userId);
  return { ok: true };
};
/** Store initialization for personal databases. */
exports.getPersonalStoreId = async (userId) => {
  const row = await db.prepare(
    "SELECT personal_store_id FROM users WHERE id = ? LIMIT 1"
  ).get(userId);
  return row ? row.personal_store_id : null;
};
exports.setPersonalStoreId = async (userId, storeId) => {
  await db.prepare(
    "UPDATE users SET personal_store_id = ? WHERE id = ?"
  ).run(storeId, userId);
  return storeId;
};
exports.initializePersonalStore = async (userId, userData, config) => {
  const { decrypt } = require("../helpers/encryption");
  const personalDb = require("../services/personalDb");
  const cfg = {
    host: config.connection_host,
    port: config.connection_port,
    database: config.connection_database,
    username: config.connection_username,
    password: decrypt(config.encrypted_password),
    sslMode: config.ssl_mode || "no-verify",
  };
  const pool = personalDb.getPool(cfg, userId);
  // Check if stores already exist in personal DB
  const existingStores = await personalDb.getStores(pool);
  if (existingStores && existingStores.length > 0) {
    // Use the first store, don't create duplicates
    const store = existingStores[0];
    await exports.setPersonalStoreId(userId, store.id);
    return { store, created: false };
  }
  // Initialize schema if needed
  await personalDb.initializeSchema(pool);
  // Create default store
  const store = await personalDb.initializeStore(pool, userData);
  await exports.setPersonalStoreId(userId, store.id);
  return { store, created: true };
};
module.exports = exports;
