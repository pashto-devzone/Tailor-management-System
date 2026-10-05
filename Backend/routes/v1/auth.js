const express = require("express");
const router = express.Router();
const authController = require("../../controllers/authController");
const { registerValidation, loginValidation } = require("../../middlewares/validation");
const { loginRateLimit, registerRateLimit } = require("../../middlewares/rateLimit");
const { authenticate } = require("../../middlewares/auth");

router.post("/register", registerRateLimit(), registerValidation, authController.register);
router.post("/login", loginRateLimit(), loginValidation, authController.login);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

module.exports = router;
