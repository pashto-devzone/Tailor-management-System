const db = require("../config/db");
const settingsModel = require("./settingsModel");
const orderNumberModel = require("./orderNumberModel");

async function backfillMissingOrderNumbers(storeId = 1) {
  const settings = await settingsModel.getSettings(storeId);
  const start = Number(settings?.orderNumberStartingPoint || settings?.orderNumberStart || 5000);
  const rows = await db.prepare(
    "SELECT id FROM orders WHERE is_deleted = FALSE AND store_id = ? AND (order_number IS NULL OR BTRIM(order_number) = '') ORDER BY created_at ASC",
  ).all(storeId);
  let current = Number.isFinite(start) ? start : 5000;
  if (rows.length) current = Number(await orderNumberModel.getNextOrderNumber(current, storeId));
  for (const row of rows) {
    await db.prepare("UPDATE orders SET order_number = ? WHERE id = ? AND store_id = ?").run(String(current++), row.id, storeId);
  }
}

exports.createOrder = async (data) => {
  const {
    order_number, customer_id, dress_type, total_amount, paid_amount, remaining_amount,
    payment_status, delivery_date, status, storeId = 1, userId = null,
  } = data;
  return db.prepare(
    `INSERT INTO orders (store_id, order_number, customer_id, dress_type, price, advance, balance,
      total_amount, paid_amount, remaining_amount, payment_status, delivery_date, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).run(
    storeId, order_number ?? null, customer_id, dress_type, total_amount, paid_amount,
    remaining_amount, total_amount, paid_amount, remaining_amount, payment_status,
    delivery_date, status, userId,
  );
};

const orderSelect = `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
  FROM orders o LEFT JOIN customers c ON o.customer_id = c.id`;

exports.getOrders = async (storeId = 1) => {
  await backfillMissingOrderNumbers(storeId);
  return db.prepare(
    `${orderSelect} WHERE o.is_deleted = FALSE AND o.store_id = ? AND (c.is_deleted IS NULL OR c.is_deleted = FALSE) ORDER BY o.created_at DESC`,
  ).all(storeId);
};

exports.getOrdersByCustomerId = async (customer_id, storeId = 1) => {
  await backfillMissingOrderNumbers(storeId);
  return db.prepare(
    `${orderSelect} WHERE o.customer_id = ? AND o.store_id = ? AND o.is_deleted = FALSE AND (c.is_deleted IS NULL OR c.is_deleted = FALSE) ORDER BY o.created_at DESC`,
  ).all(customer_id, storeId);
};

exports.getOrderById = async (id, storeId = 1) => db.prepare(
  `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
   FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
   WHERE o.id = ? AND o.store_id = ? AND o.is_deleted = FALSE AND (c.is_deleted IS NULL OR c.is_deleted = FALSE)`,
).get(id, storeId);

exports.updateOrder = async ({
  id, dress_type, total_amount, paid_amount, remaining_amount, payment_status,
  delivery_date, status, storeId = 1, userId = null,
}) => db.prepare(
  `UPDATE orders SET dress_type = ?, price = ?, advance = ?, balance = ?, total_amount = ?,
    paid_amount = ?, remaining_amount = ?, payment_status = ?, delivery_date = ?, status = ?, updated_by = ?
   WHERE id = ? AND store_id = ?`,
).run(
  dress_type, total_amount, paid_amount, remaining_amount, total_amount, paid_amount,
  remaining_amount, payment_status, delivery_date, status, userId, id, storeId,
);

exports.updateOrderPayment = async ({ id, paid_amount, remaining_amount, payment_status, storeId = 1 }) =>
  db.prepare(
    "UPDATE orders SET paid_amount = ?, advance = ?, remaining_amount = ?, balance = ?, payment_status = ? WHERE id = ? AND store_id = ?",
  ).run(paid_amount, paid_amount, remaining_amount, remaining_amount, payment_status, id, storeId);

exports.deleteOrder = async (id, storeId = 1) => db.prepare(
  "DELETE FROM orders WHERE id = ? AND store_id = ?",
).run(id, storeId);

exports.softDeleteOrder = async (id, deletedBy = null, storeId = 1) => db.prepare(
  "UPDATE orders SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, deleted_by = COALESCE(?, deleted_by) WHERE id = ? AND store_id = ?",
).run(deletedBy, id, storeId);

exports.restoreOrder = async (id, storeId = 1) => db.prepare(
  "UPDATE orders SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL WHERE id = ? AND store_id = ?",
).run(id, storeId);

exports.searchOrders = async (q, storeId = 1) => {
  const query = String(q ?? "").trim();
  if (!query) return exports.getOrders(storeId);
  const like = `%${query.replace(/%/g, "\\%")}%`;
  return db.prepare(
    `${orderSelect} WHERE o.is_deleted = FALSE AND o.store_id = ? AND (c.is_deleted IS NULL OR c.is_deleted = FALSE)
      AND (LOWER(c.name) LIKE LOWER(?) OR LOWER(c.phone) LIKE LOWER(?) OR LOWER(o.order_number) LIKE LOWER(?))
      ORDER BY o.created_at DESC`,
  ).all(storeId, like, like, like);
};

exports.getDeletedOrdersForRecycleBin = async (storeId = 1) => db.prepare(
  `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.is_deleted AS customer_is_deleted
   FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
   WHERE o.is_deleted = TRUE AND o.store_id = ? ORDER BY o.deleted_at DESC`,
).all(storeId);

exports.deleteOrderForever = async (id, storeId = 1) => db.prepare(
  "DELETE FROM orders WHERE id = ? AND store_id = ?",
).run(id, storeId);

exports.cleanupExpiredRecycleBin = async (storeId = 1) => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  for (const table of ["orders", "measurements", "customers"]) {
    await db.prepare(
      `DELETE FROM ${table} WHERE is_deleted = TRUE AND store_id = ? AND deleted_at IS NOT NULL AND deleted_at <= ?`,
    ).run(storeId, cutoff);
  }
};
