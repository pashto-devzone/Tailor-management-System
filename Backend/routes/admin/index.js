const express = require("express");
const router = express.Router();
const { authenticateAdmin } = require("../../middlewares/adminAuth");
const { rateLimit } = require("../../middlewares/rateLimit");
const dashboardController = require("../../controllers/admin/dashboardController");
const storeController = require("../../controllers/admin/storeController");
const userController = require("../../controllers/admin/userController");
const activityController = require("../../controllers/admin/activityController");
const adminController = require("../../controllers/admin/adminController");

const adminRateLimit = rateLimit({
  name: "admin-api",
  windowMs: 60_000,
  max: 100,
  keyGenerator: (req) => req.admin?.id || req.ip || "unknown",
});

router.use(authenticateAdmin, adminRateLimit);

router.get("/dashboard/stats", dashboardController.getDashboardStats);
router.get("/me", adminController.me);

router.get("/stores", storeController.getStores);
router.get("/stores/:id", storeController.getStoreById);
router.put("/stores/:id/status", storeController.updateStoreStatus);

router.get("/users", userController.getUsers);
router.get("/users/:id", userController.getUserById);

router.get("/activity", activityController.getActivityLog);

module.exports = router;
