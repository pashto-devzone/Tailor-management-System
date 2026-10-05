const db = require("../../config/db");
const { sendSuccess, sendError } = require("../../helpers/response");

exports.getStores = async (req, res) => {
  try {
    const { search = "", status = "all", sort = "newest", page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let sql = `SELECT s.id, s.name, s.slug, s.status, s.plan, s.subscription_status, s.created_at, s.last_activity_at, 
      (SELECT u.name FROM users u WHERE u.store_id = s.id AND u.role = 'owner' LIMIT 1) as owner_name,
      (SELECT u.email FROM users u WHERE u.store_id = s.id AND u.role = 'owner' LIMIT 1) as owner_email,
      (SELECT COUNT(*) FROM users WHERE users.store_id = s.id) as user_count,
      (SELECT COUNT(*) FROM customers WHERE customers.store_id = s.id AND customers.is_deleted = 0) as customer_count,
      (SELECT COUNT(*) FROM orders WHERE orders.store_id = s.id AND orders.is_deleted = 0) as order_count
      FROM stores s`;

    const params = [];
    const conditions = [];

    if (search) {
      conditions.push("(s.name LIKE ? OR owner_name LIKE ? OR owner_email LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    if (status && status !== "all") {
      conditions.push("s.status = ?");
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY s.created_at DESC";
    if (sort === "oldest") {
      sql = sql.replace("ORDER BY s.created_at DESC", "ORDER BY s.created_at ASC");
    }

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const rows = db.prepare(sql).all(...params);
    const countResult = db.exec(
      `SELECT COUNT(*) as c FROM stores${conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : ""}`,
      ...conditions.length > 0 ? params.slice(0, -2) : []
    );

    const total = countResult?.[0]?.values?.[0]?.[0] || 0;

    return sendSuccess(
      res,
      {
        stores: rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          status: r.status,
          plan: r.plan,
          subscription_status: r.subscription_status,
          created_at: r.created_at,
          last_activity_at: r.last_activity_at,
          owner_name: r.owner_name,
          owner_email: r.owner_email,
          user_count: r.user_count,
          customer_count: r.customer_count,
          order_count: r.order_count,
        })),
        pagination: { page: pageNum, limit: limitNum, total },
      },
      "Stores loaded successfully",
      200
    );
  } catch (err) {
    console.error("[admin-stores] Error:", err.message);
    return sendError(res, "Failed to load stores", 500);
  }
};

exports.getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    const storeId = Number(id);

    if (!Number.isFinite(storeId)) {
      return sendError(res, "Invalid store ID", 400);
    }

    const storeResult = db.prepare(
      "SELECT id, name, slug, status, plan, subscription_status, subscription_start, subscription_end, trial_start, trial_end, license_type, license_active, created_at, last_activity_at FROM stores WHERE id = ?"
    ).get(storeId);

    if (!storeResult) {
      return sendError(res, "Store not found", 404);
    }

    const ownerResult = db.prepare(
      "SELECT id, name, email, role, created_at FROM users WHERE store_id = ? AND role = 'owner'"
    ).get(storeId);

    const customerCount = db.prepare(
      "SELECT COUNT(*) as c FROM customers WHERE store_id = ? AND is_deleted = 0"
    ).get(storeId)?.c || 0;

    const orderCount = db.prepare(
      "SELECT COUNT(*) as c FROM orders WHERE store_id = ? AND is_deleted = 0"
    ).get(storeId)?.c || 0;

    const measurementCount = db.prepare(
      "SELECT COUNT(*) as c FROM measurements WHERE store_id = ? AND is_deleted = 0"
    ).get(storeId)?.c || 0;

    const userCount = db.prepare(
      "SELECT COUNT(*) as c FROM users WHERE store_id = ?"
    ).get(storeId)?.c || 0;

    const apiKeyCountResult = db.prepare(
      "SELECT COUNT(*) as c FROM api_keys WHERE store_id = ? AND is_active = 1"
    ).get(storeId);
    const activeApiKeyCount = apiKeyCountResult?.c || 0;

    return sendSuccess(
      res,
      {
        store: {
          id: storeResult.id,
          name: storeResult.name,
          slug: storeResult.slug,
          status: storeResult.status,
          plan: storeResult.plan,
          subscription_status: storeResult.subscription_status,
          subscription_start: storeResult.subscription_start,
          subscription_end: storeResult.subscription_end,
          trial_start: storeResult.trial_start,
          trial_end: storeResult.trial_end,
          license_type: storeResult.license_type,
          license_active: storeResult.license_active,
          created_at: storeResult.created_at,
          last_activity_at: storeResult.last_activity_at,
        },
        owner: ownerResult
          ? { id: ownerResult.id, name: ownerResult.name, email: ownerResult.email, role: ownerResult.role, created_at: ownerResult.created_at }
          : null,
        stats: {
          customer_count: customerCount,
          order_count: orderCount,
          measurement_count: measurementCount,
          user_count: userCount,
          active_api_keys: activeApiKeyCount,
        },
      },
      "Store details loaded",
      200
    );
  } catch (err) {
    console.error("[admin-stores] Detail error:", err.message);
    return sendError(res, "Failed to load store details", 500);
  }
};

exports.updateStoreStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const storeId = Number(id);
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const log = require("./adminController").logActivity;

    if (!Number.isFinite(storeId)) {
      return sendError(res, "Invalid store ID", 400);
    }

    const validStatuses = ["active", "suspended", "disabled"];
    if (!status || !validStatuses.includes(status)) {
      return sendError(res, "Valid status required (active, suspended, disabled)", 400);
    }

    const existing = db.prepare("SELECT id, name FROM stores WHERE id = ?").get(storeId);
    if (!existing) {
      return sendError(res, "Store not found", 404);
    }

    db.prepare("UPDATE stores SET status = ?, last_activity_at = ? WHERE id = ?").run(status, new Date().toISOString(), storeId);
    db.save();

    log(storeId, req.admin.id, "store_status_change", "store", storeId, existing.name, `Status changed to ${status}`, ip);

    return sendSuccess(res, { id: storeId, status }, `Store ${status === "active" ? "activated" : status === "suspended" ? "suspended" : "disabled"} successfully`, 200);
  } catch (err) {
    console.error("[admin-stores] Status update error:", err.message);
    return sendError(res, "Failed to update store status", 500);
  }
};
