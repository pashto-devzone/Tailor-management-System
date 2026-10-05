const db = require("../../config/db");
const { sendSuccess, sendError } = require("../../helpers/response");

exports.getActivityLog = async (req, res) => {
  try {
    const { page = "1", limit = "50", action, targetType } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let sql = "SELECT l.id, l.admin_id, a.name as admin_name, l.store_id, s.name as store_name, l.action, l.target_type, l.target_id, l.target_name, l.details, l.ip_address, l.created_at FROM admin_activity_log l LEFT JOIN admin_users a ON l.admin_id = a.id LEFT JOIN stores s ON l.store_id = s.id";
    const params = [];
    const conditions = [];

    if (action) {
      conditions.push("l.action = ?");
      params.push(action);
    }

    if (targetType) {
      conditions.push("l.target_type = ?");
      params.push(targetType);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY l.created_at DESC LIMIT ? OFFSET ?";
    params.push(limitNum, offset);

    const rows = db.prepare(sql).all(...params);

    const countSql = "SELECT COUNT(*) as c FROM admin_activity_log l" + (conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "");
    const countResult = db.exec(countSql, ...conditions.length > 0 ? params.slice(0, -2) : []);
    const total = countResult?.[0]?.values?.[0]?.[0] || 0;

    return sendSuccess(
      res,
      {
        logs: rows.map((r) => ({
          id: r.id,
          admin_id: r.admin_id,
          admin_name: r.admin_name,
          store_id: r.store_id,
          store_name: r.store_name,
          action: r.action,
          target_type: r.target_type,
          target_id: r.target_id,
          target_name: r.target_name,
          details: r.details,
          ip_address: r.ip_address,
          created_at: r.created_at,
        })),
        pagination: { page: pageNum, limit: limitNum, total },
      },
      "Activity log loaded",
      200
    );
  } catch (err) {
    console.error("[admin-activity] Error:", err.message);
    return sendError(res, "Failed to load activity log", 500);
  }
};
