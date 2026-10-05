const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../../config/db");
const { ADMIN_JWT_SECRET, ADMIN_JWT_EXPIRES } = require("../../middlewares/adminAuth");
const { sendSuccess, sendError } = require("../../helpers/response");

function logAdminActivity(storeId, adminId, action, targetType, targetId, targetName, details, ip) {
  try {
    db.prepare(
      "INSERT INTO admin_activity_log (admin_id, store_id, action, target_type, target_id, target_name, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(adminId, storeId || null, action, targetType || null, targetId || null, targetName || null, details || null, ip || null);
    db.save();
  } catch (_) {}
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const ip = req.ip || req.connection?.remoteAddress || "unknown";

    if (!email || !password) {
      return sendError(res, "Email aur password required hain", 400);
    }

    const admin = db.prepare(
      "SELECT id, email, password_hash, name, role, is_active FROM admin_users WHERE email = ?"
    ).get(email.toLowerCase().trim());

    if (!admin) {
      return sendError(res, "Invalid login details", 401);
    }

    if (!admin.is_active) {
      return sendError(res, "Account is suspended", 401);
    }

    const valid = bcrypt.compareSync(password, admin.password_hash);
    if (!valid) {
      logAdminActivity(null, null, "admin_login_failed", "admin", admin.id, admin.email, "Invalid password attempt", ip);
      return sendError(res, "Invalid login details", 401);
    }

    const sessionId = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const token = jwt.sign(
      { adminId: admin.id, role: admin.role, jti: sessionId },
      ADMIN_JWT_SECRET,
      { expiresIn: ADMIN_JWT_EXPIRES }
    );

    db.prepare(
      "INSERT INTO admin_sessions (id, admin_id, token, expires_at) VALUES (?, ?, ?, ?)"
    ).run(sessionId, admin.id, token, expiresAt);

    db.prepare(
      "UPDATE admin_users SET last_login_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), admin.id);

    db.save();

    logAdminActivity(null, admin.id, "admin_login", "admin", admin.id, admin.email, null, ip);

    return sendSuccess(res, { token, user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } }, "Admin login successful", 200);
  } catch (err) {
    console.error("[admin-auth] Login error:", err.message);
    return sendError(res, "Login failed", 500);
  }
};

exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const ip = req.ip || req.connection?.remoteAddress || "unknown";

    if (token) {
      db.prepare("DELETE FROM admin_sessions WHERE token = ?").run(token);
      db.save();
    }

    logAdminActivity(null, req.admin?.id, "admin_logout", "admin", req.admin?.id, req.admin?.email, null, ip);

    return sendSuccess(res, null, "Admin logged out successfully", 200);
  } catch (err) {
    console.error("[admin-auth] Logout error:", err.message);
    return sendError(res, "Logout failed", 500);
  }
};

exports.me = async (req, res) => {
  try {
    return sendSuccess(
      res,
      { id: req.admin.id, email: req.admin.email, name: req.admin.name, role: req.admin.role },
      "Admin profile loaded",
      200
    );
  } catch (err) {
    return sendError(res, "Failed to load profile", 500);
  }
};

exports.logActivity = logAdminActivity;
