const db = require("../config/db");

exports.getNextOrderNumber = async (orderNumberStart, storeId = 1) => {
  const parsed = Number(String(orderNumberStart ?? "").trim());
  const start = Number.isFinite(parsed) ? parsed : 5000;
  const rows = await db.prepare(
    "SELECT order_number FROM orders WHERE is_deleted = FALSE AND store_id = ? AND order_number IS NOT NULL AND BTRIM(order_number) <> ''",
  ).all(storeId);
  const numbers = rows.map((row) => Number(row.order_number)).filter(Number.isFinite);
  if (!numbers.length) return String(start);
  const max = Math.max(...numbers);
  return String(Math.max(max + 1, start));
};
