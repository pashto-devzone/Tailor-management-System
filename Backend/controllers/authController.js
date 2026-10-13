const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const db = require("../config/db");
const { JWT_SECRET, JWT_EXPIRES } = require("../middlewares/auth");
const shopModel = require("../models/shopModel");
const settingsModel = require("../models/settingsModel");

const loginAttempts = new Map();
const checkRateLimit = (ip) => {
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: Date.now() };
  if (Date.now() - attempts.lastAttempt > 60000) attempts.count = 0;
  attempts.count += 1;
  attempts.lastAttempt = Date.now();
  loginAttempts.set(ip, attempts);
  return attempts.count <= 10;
};

function sessionId() {
  return Number(BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000)));
}

exports.register = async (req, res) => {
  const { name, email, password, shopName } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: "Name, email aur password required hain" });
  if (password.length < 6) return res.status(400).json({ message: "Password kam se kam 6 characters ka hona chahiye" });
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ message: "An account with this email already exists." });

  const slug = `${email.split("@")[0]}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const store = await db.prepare("INSERT INTO stores (name, slug) VALUES (?, ?) RETURNING id").run(shopName || name, slug);
  const storeId = store.lastInsertRowid;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.prepare(
    "INSERT INTO users (store_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?) RETURNING id",
  ).run(storeId, name, email, passwordHash, "owner");
  const userId = user.lastInsertRowid;
  await shopModel.saveShop({ name: shopName || name, owner_name: name, phone: "", address: "", storeId });
  await settingsModel.saveSettings({ storeId, shopName: shopName || name, ownerName: name, phone: "", address: "", currency: "PKR" });
  const id = sessionId();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const token = jwt.sign({ userId, storeId, role: "owner", jti: String(id) }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  await db.prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)").run(id, userId, token, expiresAt);
  return res.status(201).json({ token, user: { id: userId, store_id: storeId, name, email, role: "owner" } });
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!checkRateLimit(req.ip || req.connection?.remoteAddress || "unknown")) {
    return res.status(429).json({ message: "Too many login attempts. Please try again later." });
  }
  if (!email || !password) return res.status(400).json({ message: "Email aur password required hain" });
  const user = await db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: "Invalid email/username or password." });
  }
  const id = sessionId();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const token = jwt.sign({ userId: user.id, storeId: user.store_id, role: user.role, jti: String(id) }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  await db.prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)").run(id, user.id, token, expiresAt);
  return res.json({ token, user: { id: user.id, store_id: user.store_id, name: user.name, email: user.email, role: user.role } });
};

exports.logout = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) await db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  return res.json({ message: "Logged out successfully" });
};

exports.me = (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });
  return res.json({ user: req.user });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ message: "Enter your current password and a new password of at least 6 characters." });
  }
  const user = await db.prepare("SELECT id, password_hash FROM users WHERE id = ? AND store_id = ?").get(req.user.id, req.storeId);
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    return res.status(400).json({ message: "Current password is incorrect." });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await db.prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND store_id = ?").run(hash, req.user.id, req.storeId);
  // Keep this verified session alive and revoke the user's other sessions.
  const activeToken = req.headers.authorization?.split(" ")[1] || "";
  await db.prepare("DELETE FROM sessions WHERE user_id = ? AND token <> ?").run(req.user.id, activeToken);
  return res.json({ message: "Password updated successfully. Other signed-in sessions have been logged out." });
};

const ensureResetTable = () => db.prepare(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`).run();

function getRecoveryMailer() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM, PASSWORD_RESET_URL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM || !PASSWORD_RESET_URL) return null;
  let resetUrl;
  try { resetUrl = new URL(PASSWORD_RESET_URL); } catch { return null; }
  if (!['http:', 'https:'].includes(resetUrl.protocol) || resetUrl.username || resetUrl.password) return null;
  if (process.env.NODE_ENV === "production" && resetUrl.protocol !== "https:") return null;
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  return {
    resetUrl,
    transporter: nodemailer.createTransport({ host: SMTP_HOST, port, secure, auth: { user: SMTP_USER, pass: SMTP_PASS } }),
  };
}

const recoveryAttempts = new Map();
exports.requestPasswordReset = async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const now = Date.now();
  const attempt = recoveryAttempts.get(ip) || { count: 0, since: now };
  if (now - attempt.since > 60 * 60 * 1000) { attempt.count = 0; attempt.since = now; }
  attempt.count += 1;
  recoveryAttempts.set(ip, attempt);
  if (attempt.count > 5) return res.status(429).json({ message: "Too many recovery requests. Try again later." });

  const mailer = getRecoveryMailer();
  if (!mailer) return res.status(503).json({ message: "Password recovery email is not configured. The owner must configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, and PASSWORD_RESET_URL on the backend." });
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ message: "Enter your registered email address." });
  await ensureResetTable();
  const user = await db.prepare("SELECT id, email, name FROM users WHERE LOWER(email) = LOWER(?)").get(email);
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(user.id);
    await db.prepare("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(tokenHash, user.id, new Date(now + 30 * 60 * 1000).toISOString());
    const link = new URL(mailer.resetUrl);
    // Keep the bearer token in the URL fragment so it is not sent in the
    // browser's HTTP request or ordinary web access logs.
    link.hash = new URLSearchParams({ token }).toString();
    try {
      await mailer.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: "Reset your Tailor Management System password",
        text: `Hello ${user.name},\n\nUse this link within 30 minutes to set a new password:\n${link.toString()}\n\nIf you did not request this, you can ignore this message.`,
      });
    } catch (_) {
      // Keep the public response indistinguishable for registered and
      // unregistered addresses, and do not log recovery links or tokens.
      await db.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").run(tokenHash);
    }
  }
  return res.json({ message: "If an account exists for that email, a password recovery link has been sent." });
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword || String(newPassword).length < 6) return res.status(400).json({ message: "The recovery link is invalid or expired, or the new password is too short." });
  await ensureResetTable();
  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  const reset = await db.prepare("SELECT user_id, expires_at FROM password_reset_tokens WHERE token_hash = ?").get(tokenHash);
  if (!reset || new Date(reset.expires_at).getTime() <= Date.now()) {
    if (reset) await db.prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?").run(tokenHash);
    return res.status(400).json({ message: "The recovery link is invalid or expired. Request a new link." });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await db.prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(hash, reset.user_id);
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(reset.user_id);
  await db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(reset.user_id);
  return res.json({ message: "Password reset successfully. You can now sign in." });
};
