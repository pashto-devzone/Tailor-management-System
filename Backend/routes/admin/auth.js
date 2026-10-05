const express = require("express");
const router = express.Router();
const adminController = require("../../controllers/admin/adminController");
const { loginRateLimit } = require("../../middlewares/rateLimit");
const { validateRequiredFields } = require("../../middlewares/validation");

router.post(
  "/login",
  loginRateLimit(),
  (req, res, next) => {
    const missing = validateRequiredFields(req.body || {}, ["email", "password"]);
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: "Email aur password required hain", data: null });
    }
    next();
  },
  adminController.login
);

router.post("/logout", adminController.logout);

module.exports = router;
