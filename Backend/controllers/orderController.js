const orderModel = require("../models/orderModel");
const customerModel = require("../models/customerModel");
const budgetModel = require("../models/budgetModel");
const settingsModel = require("../models/settingsModel");
const orderNumberModel = require("../models/orderNumberModel");

const paymentStatus = (paid, total) => paid <= 0 ? "Unpaid" : paid >= total ? "Paid" : "Partial";

function orderInput(body) {
  return {
    customer_id: body?.customer_id ?? body?.customerId ?? body?.customer?.id ?? body?.customer?.customer_id,
    dress_type: body?.dress_type ?? body?.dressType,
    total_amount: body?.price ?? body?.total_amount ?? body?.totalAmount,
    paid_amount: body?.advance ?? body?.paid_amount ?? body?.paidAmount,
    delivery_date: body?.delivery_date ?? body?.deliveryDate,
    suit_quantity: body?.suit_quantity ?? body?.suitQuantity,
    status: body?.status || "pending",
  };
}

exports.createOrder = async (req, res) => {
  const storeId = req.storeId;
  const input = orderInput(req.body);
  if (!input.customer_id || !input.dress_type || input.total_amount == null || input.paid_amount == null || !input.delivery_date) {
    return res.status(400).json({ message: "All fields required: customer_id, dress_type, price, advance, delivery_date" });
  }
  if (!await customerModel.getCustomerById(input.customer_id, storeId)) return res.status(404).json({ message: "Customer not found" });
  const total = Number(input.total_amount);
  const paid = Number(input.paid_amount);
  const quantity = Number(input.suit_quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ message: "Suit quantity must be a positive whole number" });
  if (!Number.isFinite(total) || !Number.isFinite(paid)) return res.status(400).json({ message: "Price and advance must be numbers" });
  const remaining = Math.max(total - paid, 0);
  const settings = await settingsModel.getSettings(storeId);
  const number = await orderNumberModel.getNextOrderNumber(settings.orderNumberStartingPoint || settings.orderNumberStart, storeId);
  const result = await orderModel.createOrder({
    order_number: number, customer_id: input.customer_id, dress_type: input.dress_type,
    suit_quantity: quantity,
    total_amount: total, paid_amount: paid, remaining_amount: remaining,
    payment_status: paymentStatus(paid, total), delivery_date: input.delivery_date,
    status: input.status, storeId, userId: req.user?.id || null,
  });
  if (paid > 0 && result.lastInsertRowid) {
    await budgetModel.upsertOrderPaymentIncome({
      linked_order_id: result.lastInsertRowid, payment_type: "advance",
      source: "Order Advance", amount: paid, date: new Date().toISOString().split("T")[0], storeId,
    });
  }
  return res.json({
    message: "Order created successfully",
    order: { id: result.lastInsertRowid, order_number: number, customer_id: input.customer_id, dress_type: input.dress_type,
      price: total, advance: paid, balance: remaining, total_amount: total, paid_amount: paid,
      remaining_amount: remaining, payment_status: paymentStatus(paid, total), delivery_date: input.delivery_date, suit_quantity: quantity, status: input.status },
  });
};

exports.getOrders = async (req, res) => {
  try {
    const orders = req.query?.q
      ? await orderModel.searchOrders(req.query.q, req.storeId)
      : await orderModel.getOrders(req.storeId);
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Order search failed" });
  }
};

exports.getOrdersByCustomerId = async (req, res) => {
  if (!await customerModel.getCustomerById(req.params.customer_id, req.storeId)) return res.status(404).json({ message: "Customer not found" });
  return res.json(await orderModel.getOrdersByCustomerId(req.params.customer_id, req.storeId));
};

exports.getOrderById = async (req, res) => {
  const order = await orderModel.getOrderById(req.params.id, req.storeId);
  if (!order) return res.status(404).json({ message: "Order not found" });
  return res.json(order);
};

exports.updateOrder = async (req, res) => {
  const input = orderInput(req.body);
  if (!input.dress_type || input.total_amount == null || input.paid_amount == null || !input.delivery_date || !req.body?.status) {
    return res.status(400).json({ message: "All fields required: dress_type, price, advance, delivery_date, status" });
  }
  const currentOrder = await orderModel.getOrderById(req.params.id, req.storeId);
  if (!currentOrder) return res.status(404).json({ message: "Order not found" });
  const total = Number(input.total_amount);
  const paid = Number(input.paid_amount);
  const quantity = Number(input.suit_quantity ?? currentOrder.suit_quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ message: "Suit quantity must be a positive whole number" });
  if (!Number.isFinite(total) || !Number.isFinite(paid)) return res.status(400).json({ message: "Price and advance must be numbers" });
  await orderModel.updateOrder({
    id: req.params.id, dress_type: input.dress_type, suit_quantity: quantity, total_amount: total, paid_amount: paid,
    remaining_amount: Math.max(total - paid, 0), payment_status: paymentStatus(paid, total),
    delivery_date: input.delivery_date, status: req.body.status, storeId: req.storeId, userId: req.user?.id || null,
  });
  return res.json({ message: "Order updated successfully" });
};

exports.updateOrderPayment = async (req, res) => {
  const existing = await orderModel.getOrderById(req.params.id, req.storeId);
  if (!existing) return res.status(404).json({ message: "Order not found" });
  if (req.body?.payment_amount == null && req.body?.action !== "full") {
    return res.status(400).json({ message: "payment_amount is required for partial payments" });
  }
  const total = Number(existing.total_amount || existing.price || 0);
  const current = Number(existing.paid_amount || existing.advance || 0);
  const paid = req.body.action === "full" ? total : Math.min(total, current + Number(req.body.payment_amount));
  if (!Number.isFinite(paid) || paid <= current && req.body.action !== "full") return res.status(400).json({ message: "Payment amount must be a positive number" });
  const remaining = Math.max(total - paid, 0);
  const status = paymentStatus(paid, total);
  await orderModel.updateOrderPayment({ id: req.params.id, paid_amount: paid, remaining_amount: remaining, payment_status: status, storeId: req.storeId });
  if (paid > current) await budgetModel.upsertOrderPaymentIncome({
    linked_order_id: Number(req.params.id), payment_type: req.body.action === "full" ? "final" : "advance",
    source: req.body.action === "full" ? "Order Final Payment" : "Order Advance",
    amount: paid - current, date: new Date().toISOString().split("T")[0], storeId: req.storeId,
  });
  return res.json({ message: "Payment updated successfully", payment_status: status, paid_amount: paid, remaining_amount: remaining });
};

exports.deleteOrder = async (req, res) => {
  await orderModel.softDeleteOrder(req.params.id, req.user?.id || null, req.storeId);
  return res.json({ message: "Order deleted successfully" });
};
