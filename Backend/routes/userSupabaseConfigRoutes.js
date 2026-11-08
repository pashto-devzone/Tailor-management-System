const express = require("express");
const router = express.Router();
const controller = require("../controllers/userSupabaseConfigController");
const { authenticate } = require("../middlewares/auth");

router.get("/", authenticate, controller.getConfig);
router.post("/", authenticate, controller.saveConfig);
router.post("/test", authenticate, controller.testConnection);
router.delete("/", authenticate, controller.disconnect);

module.exports = router;
