const jwt = require("jsonwebtoken");
const db = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

function ensureJwtSecret() {
  if (!JWT_SECRET || (process.env.NODE_ENV === "production" && JWT_SECRET.length < 32)) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters");
  }
}

async function authenticate(req, res, next) {
  let token;
  let decoded;

  try {
    ensureJwtSecret();
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(\S+)\s*$/i);
    if (!match) {
      return res.status(401).json({ code: "AUTH_INVALID", message: "Authorization header required" });
    }
    token = match[1];
  } catch (err) {
    console.error("[auth] authentication configuration is unavailable:", err.message);
    return res.status(500).json({
      code: "AUTH_CONFIGURATION_ERROR",
      message: "Authentication is temporarily unavailable. Please try again.",
    });
  }

  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ code: "AUTH_INVALID", message: "Invalid or expired token" });
  }

  let session;
  let user;
  try {
    session = await db.prepare("SELECT id, user_id, expires_at FROM sessions WHERE token = ?").get(token);
    if (!session) {
      return res.status(401).json({ code: "AUTH_INVALID", message: "Session expired or logged out" });
    }

    const expiresAt = session.expires_at == null ? NaN : new Date(session.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await db.prepare("DELETE FROM sessions WHERE id = ?").run(session.id);
      return res.status(401).json({ code: "AUTH_INVALID", message: "Session expired or logged out" });
    }

    if (
      String(session.user_id) !== String(decoded.userId) ||
      (decoded.jti != null && String(session.id) !== String(decoded.jti))
    ) {
      return res.status(401).json({ code: "AUTH_INVALID", message: "Invalid or expired token" });
    }

    user = await db.prepare("SELECT * FROM users WHERE id = ? AND store_id = ?").get(decoded.userId, decoded.storeId);
    if (!user) {
      return res.status(401).json({ code: "AUTH_INVALID", message: "User not found" });
    }
  } catch (err) {
    console.error("[auth] session verification database error:", err.message);
    return res.status(500).json({
      code: "AUTH_DATABASE_ERROR",
      message: "Unable to verify your session. Please try again.",
    });
  }

  // Resolve the personal operational store only for verified personal DB users.
  let operationalStoreId = user.store_id;
  let storeName = null;
  let storeSlug = null;

  let usesPersonalDb = false;
  try {
    const model = require("../models/userSupabaseConfigModel");
    usesPersonalDb = await model.hasPersonalDb(user.id);
  } catch (err) {
    console.error("[auth] personal database status lookup failed:", err.message);
    return res.status(500).json({
      code: "AUTH_DATABASE_ERROR",
      message: "Unable to verify your account database configuration. Please try again.",
    });
  }

  if (usesPersonalDb) {
    const model = require("../models/userSupabaseConfigModel");
    let config;
    try {
      config = await model.getConfigByUserId(user.id);
    } catch (err) {
      console.error("[auth] personal database configuration lookup failed:", err.message);
      if (model.isMissingPersonalDbSchemaError(err)) {
        console.warn("[auth] personal database schema is unavailable; using the central database.");
        config = null;
        usesPersonalDb = false;
      } else {
        return res.status(503).json({
          code: "PERSONAL_DB_UNAVAILABLE",
          message: "Unable to load your personal database configuration. Please try again.",
        });
      }
    }

    if (usesPersonalDb && (!config || !config.connection_host || !config.encrypted_password)) {
      return res.status(503).json({
        code: "PERSONAL_DB_UNAVAILABLE",
        message: "Your personal database configuration is incomplete. Reconnect it in Settings.",
      });
    }

    if (usesPersonalDb) {
      let pool;
      let store;
      let stores;
      try {
        const personalDb = require("../services/personalDb");
        const { decrypt } = require("../helpers/encryption");
        pool = personalDb.getPool({
          host: config.connection_host,
          port: config.connection_port,
          database: config.connection_database,
          username: config.connection_username,
          password: decrypt(config.encrypted_password),
          sslMode: config.ssl_mode || "no-verify",
        }, user.id);
        store = user.personal_store_id
          ? await personalDb.getStoreById(pool, user.personal_store_id)
          : null;
        if (!store) stores = await personalDb.getStores(pool);
      } catch (err) {
        console.warn("[auth] personal database is unavailable:", err.message);
        const decryptionFailed = /ENCRYPTION_KEY|decrypt|encrypted credential/i.test(err.message || "");
        return res.status(503).json({
          code: "PERSONAL_DB_UNAVAILABLE",
          message: decryptionFailed
            ? "Your personal database configuration could not be decrypted. Verify ENCRYPTION_KEY or reconnect it in Settings."
            : "Your Supabase database is unreachable. Check it is not paused, then try again.",
        });
      }

      if (!store) {
        if (!stores || stores.length === 0) {
          return res.status(503).json({
            code: "PERSONAL_DB_UNAVAILABLE",
            message: "No store is available in your personal database. Check its setup and try again.",
          });
        }
        store = stores[0];
        try {
          await model.setPersonalStoreId(user.id, store.id);
        } catch (err) {
          if (model.isMissingPersonalDbSchemaError(err)) {
            console.warn("[auth] personal store migration is unavailable; using the central database.");
            usesPersonalDb = false;
          } else {
            console.error("[auth] personal store assignment database error:", err.message);
            return res.status(500).json({
              code: "AUTH_DATABASE_ERROR",
              message: "Unable to save your personal store selection. Please try again.",
            });
          }
        }
      }
      if (usesPersonalDb) {
        operationalStoreId = store.id;
        storeName = store.name;
        storeSlug = store.slug;
      }
    }
  }

  req.user = { id: user.id, store_id: operationalStoreId, role: user.role, email: user.email, name: user.name, personal_store_id: user.personal_store_id, central_store_id: user.store_id, storeName, storeSlug };
  req.storeId = operationalStoreId;
  db.setUserContext(user.id);
  next();
}

function requireStore(req, res, next) {
  if (!req.storeId) {
    return res.status(400).json({ message: "Store context missing" });
  }
  next();
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    next();
  };
}

module.exports = { authenticate, requireStore, requireRole, JWT_SECRET, JWT_EXPIRES };





