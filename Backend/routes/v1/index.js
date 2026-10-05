const express = require("express");
const router = express.Router();

const { authenticate, requireStore } = require("../../middlewares/auth");
const { v1ResponseWrapper } = require("../../middlewares/v1ResponseWrapper");

const authRoutes = require("./auth");
const storeRoutes = require("./store");
const customerRoutes = require("../../routes/customerRoutes");
const orderRoutes = require("../../routes/orderRoutes");
const measurementRoutes = require("../../routes/measurementRoutes");
const shopRoutes = require("../../routes/shopRoutes");
const budgetRoutes = require("../../routes/budgetRoutes");
const settingsRoutes = require("../../routes/settingsRoutes");
const recycleBinRoutes = require("../../routes/recycleBinRoutes");
const trackingRoutes = require("./tracking");
const apiKeysRoutes = require("./apiKeys");
const apiKeyService = require("../../services/apiKeyService");
const customerModel = require("../../models/customerModel");
const orderModel = require("../../models/orderModel");
const orderNumberModel = require("../../models/orderNumberModel");
const settingsModel = require("../../models/settingsModel");

router.use(v1ResponseWrapper);

router.use("/auth", authRoutes);
router.use("/store", storeRoutes);
router.use("/tracking", trackingRoutes);
router.use("/api-keys", apiKeysRoutes);

// Store-scoped integration endpoint.  The API key identifies the store; a
// caller cannot provide a different store id in the request body.
router.post("/orders/external", apiKeyService.authenticateApiKey, apiKeyService.requireScope(apiKeyService.SCOPES.ORDERS_WRITE), async (req, res) => {
  try {
    const { customer_id, customer, dress_type, total_amount, paid_amount = 0, delivery_date, status = "pending" } = req.body || {};
    if (!dress_type || total_amount == null || !delivery_date || (!customer_id && !customer)) {
      return res.status(400).json({
        success: false,
        message: "customer_id or customer, dress_type, total_amount and delivery_date are required",
      });
    }
    const storeId = req.apiKey.storeId;
    let customerId = customer_id;
    if (customerId) {
      if (!await customerModel.getCustomerById(customerId, storeId)) {
        return res.status(404).json({ success: false, message: "Customer not found in this store" });
      }
    } else {
      if (!customer.name || !customer.phone || !customer.address) {
        return res.status(400).json({ success: false, message: "customer.name, customer.phone and customer.address are required" });
      }
      const created = await customerModel.createCustomer({ ...customer, storeId });
      customerId = created.lastInsertRowid;
    }
    const total = Number(total_amount);
    const paid = Number(paid_amount);
    if (!Number.isFinite(total) || !Number.isFinite(paid) || total < 0 || paid < 0 || paid > total) {
      return res.status(400).json({ success: false, message: "total_amount and paid_amount must be valid non-negative numbers" });
    }
    const settings = await settingsModel.getSettings(storeId);
    const orderNumber = await orderNumberModel.getNextOrderNumber(settings.orderNumberStartingPoint || settings.orderNumberStart, storeId);
    const result = await orderModel.createOrder({
      order_number: orderNumber, customer_id: customerId, dress_type, total_amount: total,
      paid_amount: paid, remaining_amount: total - paid,
      payment_status: paid === 0 ? "Unpaid" : paid === total ? "Paid" : "Partial",
      delivery_date, status, storeId,
    });
    return res.status(201).json({
      success: true,
      data: { id: result.lastInsertRowid, order_number: orderNumber, customer_id: customerId, total_amount: total, paid_amount: paid, remaining_amount: total - paid, payment_status: paid === 0 ? "Unpaid" : paid === total ? "Paid" : "Partial", delivery_date, status },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to create external order" });
  }
});

router.get("/orders/:orderId", apiKeyService.authenticateApiKey, apiKeyService.requireScope(apiKeyService.SCOPES.ORDERS_READ), async (req, res) => {
  try {
    const order = await orderModel.getOrderById(req.params.orderId, req.apiKey.storeId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        customer: {
          id: order.customer_id,
          name: order.customer_name,
          phone: order.customer_phone,
          address: order.customer_address,
        },
        dressType: order.dress_type,
        totalAmount: order.total_amount,
        paidAmount: order.paid_amount,
        remainingAmount: order.remaining_amount,
        paymentStatus: order.payment_status,
        deliveryDate: order.delivery_date,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
    });
  } catch (error) {
    console.error("[orders-api] order lookup failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve order" });
  }
});

router.use("/customers", authenticate, requireStore, customerRoutes);
router.use("/orders", authenticate, requireStore, orderRoutes);
router.use("/measurements", authenticate, requireStore, measurementRoutes);
router.use("/shop", authenticate, requireStore, shopRoutes);
router.use("/budget", authenticate, requireStore, budgetRoutes);
router.use("/settings", authenticate, requireStore, settingsRoutes);
router.use("/recycle-bin", authenticate, requireStore, recycleBinRoutes);

module.exports = router;
