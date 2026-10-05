const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
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
