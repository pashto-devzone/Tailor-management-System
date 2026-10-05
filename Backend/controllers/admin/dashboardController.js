const db = require("../../config/db");
const { sendSuccess, sendError } = require("../../helpers/response");

exports.getDashboardStats = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const log = require("./adminController").logActivity;
    log(null, req.admin.id, "dashboard_view", null, null, null, null, ip);

    const storesResult = db.exec("SELECT COUNT(*) as c FROM stores");
    const totalStores = storesResult?.[0]?.values?.[0]?.[0] || 0;

    const activeStoresResult = db.exec("SELECT COUNT(*) as c FROM stores WHERE status = 'active'");
    const activeStores = activeStoresResult?.[0]?.values?.[0]?.[0] || 0;

    const suspendedStoresResult = db.exec("SELECT COUNT(*) as c FROM stores WHERE status = 'suspended'");
    const suspendedStores = suspendedStoresResult?.[0]?.values?.[0]?.[0] || 0;

    const disabledStoresResult = db.exec("SELECT COUNT(*) as c FROM stores WHERE status = 'disabled'");
    const disabledStores = disabledStoresResult?.[0]?.values?.[0]?.[0] || 0;

    const totalUsersResult = db.exec("SELECT COUNT(*) as c FROM users");
    const totalUsers = totalUsersResult?.[0]?.values?.[0]?.[0] || 0;

    const totalCustomersResult = db.exec("SELECT COUNT(*) as c FROM customers WHERE is_deleted = 0");
    const totalCustomers = totalCustomersResult?.[0]?.values?.[0]?.[0] || 0;

    const totalOrdersResult = db.exec("SELECT COUNT(*) as c FROM orders WHERE is_deleted = 0");
    const totalOrders = totalOrdersResult?.[0]?.values?.[0]?.[0] || 0;

    const totalRevenueResult = db.exec("SELECT COALESCE(SUM(paid_amount), 0) as c FROM orders WHERE is_deleted = 0");
    const totalRevenue = totalRevenueResult?.[0]?.values?.[0]?.[0] || 0;

    const recentStoresResult = db.exec(
      "SELECT s.id, s.name, (SELECT u.name FROM users u WHERE u.store_id = s.id AND u.role = 'owner' LIMIT 1) as owner_name, s.created_at, s.status FROM stores s ORDER BY s.created_at DESC LIMIT 5"
    );
    const recentStores = recentStoresResult?.[0]?.values || [];

    const recentOrdersResult = db.exec(
      "SELECT o.order_number, o.status, o.total_amount, o.created_at, s.name as store_name FROM orders o JOIN stores s ON o.store_id = s.id WHERE o.is_deleted = 0 ORDER BY o.created_at DESC LIMIT 5"
    );
    const recentOrders = recentOrdersResult?.[0]?.values || [];

    return sendSuccess(
      res,
      {
        totalStores,
        activeStores,
        suspendedStores,
        disabledStores,
        totalUsers,
        totalCustomers,
        totalOrders,
        totalRevenue,
        recentStores: recentStores.map((r) => ({
          id: r[0],
          name: r[1],
          owner_name: r[2],
          created_at: r[3],
          status: r[4],
        })),
        recentOrders: recentOrders.map((r) => ({
          order_number: r[0],
          status: r[1],
          total_amount: r[2],
          created_at: r[3],
          store_name: r[4],
        })),
      },
      "Dashboard statistics loaded",
      200
    );
  } catch (err) {
    console.error("[admin-dashboard] Error:", err.message);
    return sendError(res, "Failed to load dashboard statistics", 500);
  }
};
