const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { requireRole } = require("../middlewares/auth");

router.get("/", settingsController.getSettings);
router.put("/", requireRole(["owner"]), settingsController.saveSettings);
router.post("/", requireRole(["owner"]), settingsController.saveSettings);

module.exports = router;
