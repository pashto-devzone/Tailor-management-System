const express = require("express");
const router = express.Router();

const backupController = require("../controllers/backupController");
const upload = require("../middlewares/uploadMiddleware");
const { requireRole } = require("../middlewares/auth");

router.post("/create", backupController.createBackup);
router.post("/restore", requireRole(["owner"]), upload.single("file"), backupController.restoreBackup);

module.exports = router;
