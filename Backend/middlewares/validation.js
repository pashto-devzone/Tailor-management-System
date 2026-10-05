const { sendError } = require("../helpers/response");

function validateEmail(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

function validatePassword(password) {
  if (!password || typeof password !== "string") return false;
  return password.length >= 6;
}

function validateName(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
}

function validateString(value, maxLength = 1000) {
  if (value === undefined || value === null) return true;
  if (typeof value !== "string") return false;
  return value.length <= maxLength;
}

function validateOptionalString(value, maxLength = 1000) {
  if (value === undefined || value === null || value === "") return true;
  return validateString(value, maxLength);
}

function validateNumber(value) {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n);
  }
  return false;
}

function validateInteger(value) {
  if (value === undefined || value === null || value === "") return true;
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n);
}

function validateDate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function validateRequiredFields(body, fields) {
  const missing = [];
  for (const field of fields) {
    const val = body[field];
    if (val === undefined || val === null || val === "") {
      missing.push(field);
    }
  }
  return missing;
}

function registerValidation(req, res, next) {
  const { name, email, password } = req.body || {};
  const missing = validateRequiredFields(req.body, ["name", "email", "password"]);
  if (missing.length > 0) {
    return sendError(res, "Name, email aur password required hain", 400);
  }
  if (!validateName(name)) {
    return sendError(res, "Valid name required", 400);
  }
  if (!validateEmail(email)) {
    return sendError(res, "Valid email required", 400);
  }
  if (!validatePassword(password)) {
    return sendError(res, "Password kam se kam 6 characters ka hona chahiye", 400);
  }
  next();
}

function loginValidation(req, res, next) {
  const missing = validateRequiredFields(req.body, ["email", "password"]);
  if (missing.length > 0) {
    return sendError(res, "Email aur password required hain", 400);
  }
  next();
}

function customerValidation(req, res, next) {
  const missing = validateRequiredFields(req.body, ["name", "phone", "address"]);
  if (missing.length > 0) {
    return sendError(res, "Naam, phone aur address required hain", 400);
  }
  next();
}

function validateStoreIdParam(req, res, next) {
  const { id } = req.params;
  if (!validateInteger(id)) {
    return sendError(res, "Invalid ID", 400);
  }
  next();
}

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validateString,
  validateOptionalString,
  validateNumber,
  validateInteger,
  validateDate,
  validateRequiredFields,
  registerValidation,
  loginValidation,
  customerValidation,
  validateStoreIdParam,
};
