const db = require("../config/db");

const parseSerialNumber = (serial) => {
  if (serial === undefined || serial === null || String(serial).trim() === "") return null;
  const number = Number(serial);
  return Number.isNaN(number) ? null : number;
};

async function getNextSerialNumber(storeId = 1) {
  const settings = await db.prepare(
    "SELECT customerserialstart FROM settings WHERE store_id = ? LIMIT 1",
  ).get(storeId);
  const configured = parseSerialNumber(settings?.customerserialstart);
  const rows = await db.prepare(
    "SELECT serial_number FROM customers WHERE is_deleted = FALSE AND store_id = ?",
  ).all(storeId);
  const numbers = rows.map((row) => parseSerialNumber(row.serial_number)).filter((n) => n !== null);
  return String(numbers.length ? Math.max(...numbers, configured ?? 0) + (Math.max(...numbers) >= (configured ?? 0) ? 1 : 0) : configured ?? 0);
}

exports.createCustomer = async ({ name, phone, address, serial_number = null, storeId = 1, userId = null }) =>
  db.prepare(
    "INSERT INTO customers (store_id, serial_number, name, phone, address, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
  ).run(storeId, serial_number ? String(serial_number) : await getNextSerialNumber(storeId), name, phone, address, userId);

exports.getCustomers = async (storeId = 1) => db.prepare(
  "SELECT * FROM customers WHERE is_deleted = FALSE AND store_id = ? ORDER BY id DESC",
).all(storeId);

exports.getCustomerById = async (id, storeId = 1) => db.prepare(
  "SELECT * FROM customers WHERE id = ? AND is_deleted = FALSE AND store_id = ?",
).get(id, storeId);

exports.updateCustomer = async ({ id, name, phone, address, serial_number, storeId = 1, userId = null }) =>
  db.prepare(
    "UPDATE customers SET serial_number = COALESCE(?, serial_number), name = ?, phone = ?, address = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND store_id = ?",
  ).run(serial_number ?? null, name, phone, address, userId, id, storeId);

exports.deleteCustomer = async (id, storeId = 1) =>
  db.prepare("DELETE FROM customers WHERE id = ? AND store_id = ?").run(id, storeId);

exports.softDeleteCustomer = async (id, deletedBy = null, storeId = 1) =>
  db.prepare(
    "UPDATE customers SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, deleted_by = COALESCE(?, deleted_by) WHERE id = ? AND store_id = ?",
  ).run(deletedBy, id, storeId);

exports.restoreCustomer = async (id, storeId = 1) =>
  db.prepare(
    "UPDATE customers SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL WHERE id = ? AND store_id = ?",
  ).run(id, storeId);

exports.getDeletedCustomersForRecycleBin = async (storeId = 1) => db.prepare(
  "SELECT id, name, phone, deleted_at, deleted_by, is_deleted FROM customers WHERE is_deleted = TRUE AND store_id = ? ORDER BY deleted_at DESC",
).all(storeId);

exports.deleteCustomerForever = async (id, storeId = 1) =>
  db.prepare("DELETE FROM customers WHERE id = ? AND store_id = ?").run(id, storeId);
