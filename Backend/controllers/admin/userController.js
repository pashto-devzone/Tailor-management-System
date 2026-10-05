const db = require("../../config/db");
const { sendSuccess, sendError } = require("../../helpers/response");

exports.getUsers = async (req, res) => {
  try {
    const { search = "", storeId, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let sql = "SELECT u.id, u.name, u.email, u.role, u.store_id, u.created_at, u.updated_at, s.name as store_name FROM users u LEFT JOIN stores s ON u.store_id = s.id";
    const params = [];
    const conditions = [];

    if (storeId) {
      conditions.push("u.store_id = ?");
      params.push(Number(storeId));
    }

    if (search) {
      conditions.push("(u.name LIKE ? OR u.email LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY u.created_at DESC LIMIT ? OFFSET ?";
    params.push(limitNum, offset);

    const rows = db.prepare(sql).all(...params);

    const countSql = "SELECT COUNT(*) as c FROM users u LEFT JOIN stores s ON u.store_id = s.id" + (conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "");
    const countResult = db.exec(countSql, ...conditions.length > 0 ? params.slice(0, -2) : []);
    const total = countResult?.[0]?.values?.[0]?.[0] || 0;

    return sendSuccess(
      res,
      {
        users: rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.role,
          store_id: r.store_id,
          store_name: r.store_name,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
        pagination: { page: pageNum, limit: limitNum, total },
      },
      "Users loaded successfully",
      200
    );
  } catch (err) {
    console.error("[admin-users] Error:", err.message);
    return sendError(res, "Failed to load users", 500);
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = Number(id);

    if (!Number.isFinite(userId)) {
      return sendError(res, "Invalid user ID", 400);
    }

    const user = db.prepare(
      "SELECT u.id, u.name, u.email, u.role, u.store_id, u.created_at, u.updated_at, s.name as store_name, s.status as store_status FROM users u LEFT JOIN stores s ON u.store_id = s.id WHERE u.id = ?"
    ).get(userId);

    if (!user) {
      return sendError(res, "User not found", 404);
    }

    return sendSuccess(
      res,
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          store_id: user.store_id,
          store_name: user.store_name,
          store_status: user.store_status,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      },
      "User details loaded",
      200
    );
  } catch (err) {
    console.error("[admin-users] Detail error:", err.message);
    return sendError(res, "Failed to load user details", 500);
  }
};
