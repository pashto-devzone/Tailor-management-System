const express = require("express");
const router = express.Router();
const db = require("../../config/db");
const { trackingRateLimit } = require("../../middlewares/rateLimit");
const { authenticateApiKey, requireScope, SCOPES } = require("../../services/apiKeyService");

const SAFE_ORDER_FIELDS = ["id", "order_number", "dress_type", "delivery_date", "status", "created_at", "total_amount", "paid_amount", "remaining_amount", "payment_status"];

function safeOrderRow(row) {
  if (!row) return null;
  const safe = {};
  for (const field of SAFE_ORDER_FIELDS) {
    safe[field] = row[field];
  }
  return safe;
}

router.get(
  "/orders/:orderNumber",
  trackingRateLimit(),
  authenticateApiKey,
  requireScope(SCOPES.ORDERS_READ),
  async (req, res) => {
    try {
      const { orderNumber } = req.params;
      if (!orderNumber) {
        return res.status(400).json({ success: false, message: "Order number is required" });
      }

      const storeId = req.apiKey.storeId;

      const row = await db.prepare(
        "SELECT o.id, o.order_number, o.dress_type, o.delivery_date, o.status, o.created_at, o.total_amount, o.paid_amount, o.remaining_amount, o.payment_status FROM orders o WHERE o.order_number = ? AND o.store_id = ? AND o.is_deleted = FALSE LIMIT 1"
      ).get(orderNumber, storeId);

      if (!row) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      return res.json({
        success: true,
        message: "Order tracking information",
        data: safeOrderRow(row),
      });
    } catch (err) {
      console.error("[tracking] Error:", err.message);
      return res.status(500).json({ success: false, message: "Unable to fetch order information" });
    }
  }
);

router.get(
  "/orders",
  trackingRateLimit(),
  authenticateApiKey,
  requireScope(SCOPES.ORDERS_READ),
  async (req, res) => {
    try {
      const { q, limit } = req.query;
      const storeId = req.apiKey.storeId;
      const maxLimit = Math.min(Number(limit) || 50, 100);

      let stmt;
      let params;

      if (q) {
        const like = `%${q}%`;
        stmt = db.prepare(
          "SELECT o.id, o.order_number, o.dress_type, o.delivery_date, o.status, o.created_at, o.total_amount, o.paid_amount, o.remaining_amount, o.payment_status FROM orders o WHERE o.store_id = ? AND o.is_deleted = FALSE AND (o.order_number LIKE ? OR o.dress_type LIKE ?) ORDER BY o.created_at DESC LIMIT ?"
        );
        params = [storeId, like, like, maxLimit];
      } else {
        stmt = db.prepare(
          "SELECT o.id, o.order_number, o.dress_type, o.delivery_date, o.status, o.created_at, o.total_amount, o.paid_amount, o.remaining_amount, o.payment_status FROM orders o WHERE o.store_id = ? AND o.is_deleted = FALSE ORDER BY o.created_at DESC LIMIT ?"
        );
        params = [storeId, maxLimit];
      }

      const rows = await stmt.all(...params);

      const orders = rows.map(safeOrderRow).filter(Boolean);

      return res.json({
        success: true,
        message: "Orders loaded successfully",
        data: orders,
      });
    } catch (err) {
      console.error("[tracking] Error:", err.message);
      return res.status(500).json({ success: false, message: "Unable to fetch orders" });
    }
  }
);

module.exports = router;
