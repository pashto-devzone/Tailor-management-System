const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

router.post("/", orderController.createOrder);
router.get("/", orderController.getOrders);
router.get("/detail/:id", orderController.getOrderById);
router.post("/:id/payment", orderController.updateOrderPayment);
router.get("/:customer_id", orderController.getOrdersByCustomerId);
router.put("/:id", orderController.updateOrder);
router.delete("/:id", orderController.deleteOrder);

module.exports = router;
