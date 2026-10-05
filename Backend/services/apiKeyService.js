const db = require("../config/db");
const crypto = require("crypto");

const API_KEY_SECRET = process.env.API_KEY_SECRET;

function ensureApiKeySecret() {
  if (!API_KEY_SECRET || (process.env.NODE_ENV === "production" && API_KEY_SECRET.length < 32)) {
    throw new Error("API_KEY_SECRET must be configured with at least 32 characters");
  }
}

const SCOPES = {
  ORDERS_READ: "orders:read",
  ORDERS_WRITE: "orders:write",
  CUSTOMERS_READ: "customers:read",
  CUSTOMERS_WRITE: "customers:write",
  MEASUREMENTS_READ: "measurements:read",
  MEASUREMENTS_WRITE: "measurements:write",
};

const ALL_SCOPES = Object.values(SCOPES);

function generateApiKey() {
  const rawKey = crypto.randomBytes(32).toString("hex");
  const prefix = "tms_";
  const fullKey = prefix + rawKey;
  const hash = hashApiKey(fullKey);
  return { fullKey, hash };
}

function hashApiKey(apiKey) {
  ensureApiKeySecret();
  return crypto.createHmac("sha256", API_KEY_SECRET).update(apiKey).digest("hex");
}

async function createApiKey({ storeId, name, scopes = [], userId = null }) {
  const { fullKey, hash } = generateApiKey();

  const scopesStr = Array.isArray(scopes) ? scopes.join(",") : "";
  const result = await db.prepare(
    "INSERT INTO api_keys (store_id, key_hash, name, scopes, is_active, created_by) VALUES (?, ?, ?, ?, TRUE, ?) RETURNING id",
  ).run(storeId, hash, name, scopesStr, userId);

  const keyId = result.lastInsertRowid;

  if (Array.isArray(scopes)) {
    for (const scope of scopes) {
      await db.prepare(
        "INSERT INTO api_key_scopes (store_id, api_key_id, scope) VALUES (?, ?, ?)"
      ).run(storeId, keyId, scope);
    }
  }

  return { id: keyId, apiKey: fullKey, name, scopes: scopesStr ? scopesStr.split(",") : [] };
}

async function getApiKeyById(id, storeId) {
  const row = await db.prepare("SELECT * FROM api_keys WHERE id = ? AND store_id = ?").get(id, storeId);
  if (!row) return null;

  const scopeRows = await db.prepare(
    "SELECT scope FROM api_key_scopes WHERE api_key_id = ?"
  ).all(row.id);

  const scopes = scopeRows.map(r => r.scope);
  return { ...row, scopes };
}

async function getApiKeysByStore(storeId) {
  const rows = await db.prepare(
    "SELECT id, name, scopes, is_active, created_by, created_at, last_used_at FROM api_keys WHERE store_id = ? ORDER BY created_at DESC"
  ).all(storeId);

  return rows.map(row => ({
    ...row,
    scopes: row.scopes ? row.scopes.split(",") : [],
  }));
}

async function revokeApiKey(id, storeId) {
  const result = await db.prepare(
    "UPDATE api_keys SET is_active = FALSE WHERE id = ? AND store_id = ?",
  ).run(id, storeId);

  if (result.changes > 0) {
    await db.prepare("DELETE FROM api_key_scopes WHERE api_key_id = ?").run(id);
  }

  return result.changes;
}

async function deleteApiKey(id, storeId) {
  const result = await db.prepare(
    "DELETE FROM api_keys WHERE id = ? AND store_id = ?"
  ).run(id, storeId);

  if (result.changes > 0) {
    await db.prepare("DELETE FROM api_key_scopes WHERE api_key_id = ?").run(id);
  }

  return result.changes;
}

async function authenticateApiKey(req, res, next) {
  try {
    ensureApiKeySecret();
    const header = req.headers["x-api-key"] || req.headers["authorization"];
    let apiKey;

    if (header) {
      if (header.startsWith("Bearer ")) {
        apiKey = header.substring(7);
      } else {
        apiKey = header;
      }
    }

    if (!apiKey) {
      return res.status(401).json({ success: false, message: "API key required" });
    }

    const keyHash = hashApiKey(apiKey);
    const row = await db.prepare(
      "SELECT id, store_id, name, is_active FROM api_keys WHERE key_hash = ?"
    ).get(keyHash);

    if (!row) {
      return res.status(401).json({ success: false, message: "Invalid API key" });
    }

    if (!row.is_active) {
      return res.status(403).json({ success: false, message: "API key is revoked" });
    }

    const scopeRows = await db.prepare(
      "SELECT scope FROM api_key_scopes WHERE api_key_id = ?"
    ).all(row.id);

    const scopes = scopeRows.map(r => r.scope);

    await db.prepare(
      "UPDATE api_keys SET last_used_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), row.id);
    req.apiKey = {
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      scopes,
    };
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: "API key authentication failed" });
  }
}

function requireScope(scope) {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    if (!req.apiKey.scopes.includes(scope) && !req.apiKey.scopes.includes("*")) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required scope: ${scope}`,
      });
    }
    next();
  };
}

module.exports = {
  SCOPES,
  ALL_SCOPES,
  generateApiKey,
  hashApiKey,
  createApiKey,
  getApiKeyById,
  getApiKeysByStore,
  revokeApiKey,
  deleteApiKey,
  authenticateApiKey,
  requireScope,
};
