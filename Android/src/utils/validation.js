/**
 * Form validation helpers (mirrors the backend validation contract).
 * Backend requires: password >= 6 chars, valid email, non-empty name.
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^@\s@]+$/;
  return emailRegex.test(trimmed);
};

export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 6;
};

export const validateName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
};

export const validateRequired = (...values) =>
  values.every((v) => v !== undefined && v !== null && String(v).trim() !== '');

export default { validateEmail, validatePassword, validateName, validateRequired };