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
    session = await db.central.prepare("SELECT id, user_id, expires_at FROM sessions WHERE token = ?").get(token);
    if (!session) {
      return res.status(401).json({ code: "AUTH_INVALID", message: "Session expired or logged out" });
    }

    const expiresAt = session.expires_at == null ? NaN : new Date(session.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await db.central.prepare("DELETE FROM sessions WHERE id = ?").run(session.id);
      return res.status(401).json({ code: "AUTH_INVALID", message: "Session expired or logged out" });
    }

    if (
      String(session.user_id) !== String(decoded.userId) ||
      (decoded.jti != null && String(session.id) !== String(decoded.jti))
    ) {
      return res.status(401).json({ code: "AUTH_INVALID", message: "Invalid or expired token" });
    }

    user = await db.central.prepare("SELECT * FROM users WHERE id = ?").get(decoded.userId);
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

  const usesPersonalDb = user.has_personal_db === true || user.has_personal_db === 1;
  const operationalStoreId = usesPersonalDb ? user.personal_store_id : user.store_id;
  req.user = { id: user.id, store_id: operationalStoreId, role: user.role, email: user.email, name: user.name, personal_store_id: user.personal_store_id, central_store_id: user.store_id };
  req.storeId = operationalStoreId;
  db.setUserContext(user.id);
  next();
}

async function requireStore(req, res, next) {
  if (req.user) {
    try {
      const storeId = await db.resolveOperationalStore();
      if (storeId) {
        req.storeId = storeId;
        req.user.store_id = storeId;
        req.user.personal_store_id = storeId;
      }
    } catch (err) {
      return res.status(err.status || 503).json({ code: err.code || "PERSONAL_DB_UNAVAILABLE", message: err.publicMessage ? err.message : "Your Supabase database is not reachable yet. If you just resumed it, wait a few minutes and press Retry." });
    }
  }
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





