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

    req.user = { id: user.id, store_id: user.store_id, role: user.role, email: user.email, name: user.name };
    req.storeId = user.store_id;
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
