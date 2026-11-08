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
  try {
    ensureJwtSecret();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization header required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const session = await db.prepare("SELECT id, expires_at FROM sessions WHERE token = ?").get(token);
    if (!session) {
      return res.status(401).json({ message: "Session expired or logged out" });
    }

    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      await db.prepare("DELETE FROM sessions WHERE id = ?").run(session.id);
      return res.status(401).json({ message: "Session expired or logged out" });
    }

    const user = await db.prepare("SELECT * FROM users WHERE id = ? AND store_id = ?").get(decoded.userId, decoded.storeId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Resolve operational store ID: personal DB users use their personal store ID,
    // central users use their central store ID.
    let operationalStoreId = user.store_id;
    let storeName = null;
    let storeSlug = null;

    if (user.personal_store_id) {
      try {
        const model = require("../models/userSupabaseConfigModel");
        const config = await model.getConfigByUserId(user.id);
        if (config && config.connection_host && config.encrypted_password) {
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
          const pool = personalDb.getPool(cfg, user.id);
          const store = await personalDb.getStoreById(pool, user.personal_store_id);
          if (store) {
            operationalStoreId = store.id;
            storeName = store.name;
            storeSlug = store.slug;
          } else {
            // personal_store_id no longer valid; try to re-initialize
            const stores = await personalDb.getStores(pool);
            if (stores && stores.length > 0) {
              operationalStoreId = stores[0].id;
              storeName = stores[0].name;
              storeSlug = stores[0].slug;
              await model.setPersonalStoreId(user.id, stores[0].id);
            }
          }
        }
      } catch (err) {
        console.warn("[auth] personal store resolution failed:", err.message);
        usingPersonalDb=false
      }
    }

    req.user = { id: user.id, store_id: operationalStoreId, role: user.role, email: user.email, name: user.name, personal_store_id: user.personal_store_id, central_store_id: user.store_id, storeName, storeSlug };
    req.storeId = operationalStoreId;
    db.setUserContext(user.id);
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
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





