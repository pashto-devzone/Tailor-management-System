const express = require("express");
const router = express.Router();

const updateService = require("../services/updateService");

router.get("/check", async (req, res) => {
  try {
    const result = await updateService.checkForUpdates();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Update check failed" });
  }
});

module.exports = router;

