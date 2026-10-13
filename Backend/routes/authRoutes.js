const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.requestPasswordReset);
router.post("/reset-password", authController.resetPassword);
router.post("/change-password", authenticate, authController.changePassword);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

module.exports = router;
