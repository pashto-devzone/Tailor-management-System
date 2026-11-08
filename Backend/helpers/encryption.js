"use strict";

const crypto = require("crypto");

/**
 * Encryption-at-rest for sensitive user Supabase credentials.
 *
 * The encryption master key must be provided via the ENCRYPTION_KEY environment
 * variable (32 random bytes, base64-encoded). It is kept OUTSIDE the database
 * and OUTSIDE frontend bundles — only the backend process can encrypt/decrypt.
 *
 * Never log or return the plaintext credential. The masked/last-4 representation
 * is safe to show in UI.
 */

function getEncryptionKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not configured. Set it to a 32-byte base64 value in Backend/.env or your hosting platform."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256), got ${key.length} bytes.`
    );
  }
  return key;
}

/**
 * Encrypt a plaintext string. Returns base64(iv + authTag + ciphertext).
 */
function encrypt(plaintext) {
  if (plaintext == null || plaintext === "") return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypt a base64(iv + authTag + ciphertext) string. Returns plaintext.
 */
function decrypt(ciphertextB64) {
  if (!ciphertextB64) return "";
  const key = getEncryptionKey();
  const data = Buffer.from(ciphertextB64, "base64");
  if (data.length < 28) {
    throw new Error("Invalid encrypted credential payload.");
  }
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Mask a sensitive value for display (shows only the last 4 characters).
 */
function mask(value) {
  if (!value) return "";
  const visible = value.slice(-4);
  return "•".repeat(Math.max(0, value.length - 4)) + visible;
}

module.exports = { encrypt, decrypt, mask, getEncryptionKey };
