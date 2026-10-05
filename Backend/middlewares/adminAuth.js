const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { sendError } = require("../helpers/response");

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
if (!ADMIN_JWT_SECRET) {
  console.warn("[admin-auth] ADMIN_JWT_SECRET is not configured; admin routes are disabled.");
}
const ADMIN_JWT_EXPIRES = "24h";

async function authenticateAdmin(req, res, next) {
  try {
    if (!ADMIN_JWT_SECRET) {
      return sendError(res, "Admin authentication is not configured", 503);
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, "Authorization header required", 401);
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    } catch (err) {
      return sendError(res, "Invalid or expired admin token", 401);
    }

    if (!decoded.adminId) {
      return sendError(res, "Invalid admin token", 401);
    }

    const session = db.prepare(
      "SELECT id FROM admin_sessions WHERE token = ? AND expires_at > ?"
    ).get(token, new Date().toISOString());

    if (!session) {
      return sendError(res, "Admin session expired or invalid", 401);
    }

    const admin = db.prepare(
      "SELECT id, email, name, role, is_active FROM admin_users WHERE id = ? AND is_active = 1"
    ).get(decoded.adminId);

    if (!admin) {
      return sendError(res, "Admin account not found or inactive", 401);
    }

    req.admin = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticateAdmin, ADMIN_JWT_SECRET, ADMIN_JWT_EXPIRES };
