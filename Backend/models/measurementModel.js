const db = require("../config/db");

const decode = (row) => row && ({
  ...row,
  measurements: typeof row.measurements === "string" ? JSON.parse(row.measurements) : row.measurements,
  comments: row.comments || "",
});

exports.createMeasurement = async ({ customer_id, measurements, comments = "", storeId = 1, userId = null }) =>
  db.prepare(
    "INSERT INTO measurements (store_id, customer_id, measurements, comments, created_by) VALUES (?, ?, ?::jsonb, ?, ?) RETURNING id",
  ).run(storeId, customer_id, JSON.stringify(measurements), comments, userId);

exports.getMeasurementsByCustomerId = async (customer_id, storeId = 1) =>
  (await db.prepare(
    "SELECT * FROM measurements WHERE customer_id = ? AND store_id = ? AND is_deleted = FALSE ORDER BY created_at DESC",
  ).all(customer_id, storeId)).map(decode);

exports.getMeasurementById = async (id, storeId = 1) =>
  decode(await db.prepare("SELECT * FROM measurements WHERE id = ? AND store_id = ? AND is_deleted = FALSE").get(id, storeId));

exports.updateMeasurement = async ({ id, measurements, comments, storeId = 1, userId = null }) =>
  db.prepare(
    "UPDATE measurements SET measurements = ?::jsonb, comments = COALESCE(?, comments), updated_by = ? WHERE id = ? AND store_id = ?",
  ).run(JSON.stringify(measurements), comments, userId, id, storeId);

exports.deleteMeasurement = async (id, storeId = 1) =>
  db.prepare("DELETE FROM measurements WHERE id = ? AND store_id = ?").run(id, storeId);

exports.softDeleteMeasurement = async (id, deletedBy = null, storeId = 1) =>
  db.prepare(
    "UPDATE measurements SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, deleted_by = COALESCE(?, deleted_by) WHERE id = ? AND store_id = ?",
  ).run(deletedBy, id, storeId);

exports.restoreMeasurement = async (id, storeId = 1) =>
  db.prepare(
    "UPDATE measurements SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL WHERE id = ? AND store_id = ?",
  ).run(id, storeId);

exports.getDeletedMeasurementsForRecycleBin = async (storeId = 1) =>
  (await db.prepare(
    "SELECT m.*, c.name AS customer_name, c.phone AS customer_phone, c.is_deleted AS customer_is_deleted FROM measurements m LEFT JOIN customers c ON m.customer_id = c.id WHERE m.is_deleted = TRUE AND m.store_id = ? ORDER BY m.deleted_at DESC",
  ).all(storeId)).map(decode);

exports.deleteMeasurementForever = async (id, storeId = 1) =>
  db.prepare("DELETE FROM measurements WHERE id = ? AND store_id = ?").run(id, storeId);
