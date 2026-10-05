const express = require("express");
const recycleBinController = require("../controllers/recycleBinController");

const router = express.Router();

router.get("/recycle-bin", recycleBinController.listRecycleBin);
router.post("/recycle-bin/:type/:id/restore", recycleBinController.restoreRecycleBinItem);
router.delete(
  "/recycle-bin/:type/:id",
  recycleBinController.deleteForeverRecycleBinItem
);
router.post("/recycle-bin/cleanup", recycleBinController.cleanupRecycleBin);

module.exports = router;

