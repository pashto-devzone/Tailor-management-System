const express = require("express");
const router = express.Router();
const { authenticate, requireStore } = require("../../middlewares/auth");
const settingsModel = require("../../models/settingsModel");
const shopModel = require("../../models/shopModel");

router.get("/", authenticate, requireStore, async (req, res) => {
  try {
    const storeId = req.storeId;
    const settings = await settingsModel.getSettings(storeId);
    const shop = await shopModel.getShop(storeId);

    return res.json({
      success: true,
      message: "Store information loaded",
      data: {
        storeId,
        settings,
        shop,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to load store information" });
  }
});

module.exports = router;
