const express = require("express");
const router = express.Router();
const shopController = require("../controllers/shopController");
const { requireRole } = require("../middlewares/auth");

router.get("/", shopController.getShop);
router.post("/", requireRole(["owner"]), shopController.saveShop);

module.exports = router;
