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

router.post("/update", async (req, res) => {
  // mock update action
  try {
    await updateService.downloadUpdate();
    await updateService.installUpdate();
    res.json({ message: "Update action is mocked (Electron will implement later)." });
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});

module.exports = router;

