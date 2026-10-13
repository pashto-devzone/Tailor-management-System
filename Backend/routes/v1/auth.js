const express = require("express");
const router = express.Router();
const authController = require("../../controllers/authController");
const { registerValidation, loginValidation } = require("../../middlewares/validation");
const { loginRateLimit, registerRateLimit } = require("../../middlewares/rateLimit");
const { authenticate } = require("../../middlewares/auth");

router.post("/register", registerRateLimit(), registerValidation, authController.register);
router.post("/login", loginRateLimit(), loginValidation, authController.login);
router.post("/forgot-password", authController.requestPasswordReset);
router.post("/reset-password", authController.resetPassword);
router.post("/change-password", authenticate, authController.changePassword);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

module.exports = router;
