const express = require("express");
const router = express.Router();
const { authenticate, requireStore } = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/auth");
const apiKeyService = require("../../services/apiKeyService");

const apiKeyController = {
  create: async (req, res) => {
    try {
      const storeId = req.storeId;
      const userId = req.user.id;
      const { name, scopes } = req.body || {};

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ success: false, message: "API key name is required" });
      }

      const normalizedScopes = Array.isArray(scopes) ? scopes : [];
      const allowedScopes = normalizedScopes.filter((s) =>
        apiKeyService.ALL_SCOPES.includes(s) || s === "*"
      );

      const result = await apiKeyService.createApiKey({
        storeId,
        name: name.trim(),
        scopes: allowedScopes,
        userId,
      });

      return res.status(201).json({
        success: true,
        message: "API key created successfully",
        data: {
          id: result.id,
          apiKey: result.apiKey,
          name: result.name,
          scopes: result.scopes,
        },
      });
    } catch (err) {
      console.error("[apiKey] Create failed:", err.message);
      return res.status(500).json({ success: false, message: "Failed to create API key" });
    }
  },

  list: async (req, res) => {
    try {
      const storeId = req.storeId;
      const keys = await apiKeyService.getApiKeysByStore(storeId);
      return res.json({
        success: true,
        message: "API keys loaded successfully",
        data: keys,
      });
    } catch (err) {
      console.error("[apiKey] List failed:", err.message);
      return res.status(500).json({ success: false, message: "Failed to load API keys" });
    }
  },

  revoke: async (req, res) => {
    try {
      const storeId = req.storeId;
      const { id } = req.params;

      const changes = await apiKeyService.revokeApiKey(Number(id), storeId);
      if (changes === 0) {
        return res.status(404).json({ success: false, message: "API key not found" });
      }

      return res.json({
        success: true,
        message: "API key revoked successfully",
        data: { id: Number(id) },
      });
    } catch (err) {
      console.error("[apiKey] Revoke failed:", err.message);
      return res.status(500).json({ success: false, message: "Failed to revoke API key" });
    }
  },

  delete: async (req, res) => {
    try {
      const storeId = req.storeId;
      const { id } = req.params;

      const changes = await apiKeyService.deleteApiKey(Number(id), storeId);
      if (changes === 0) {
        return res.status(404).json({ success: false, message: "API key not found" });
      }

      return res.json({
        success: true,
        message: "API key deleted permanently",
        data: { id: Number(id) },
      });
    } catch (err) {
      console.error("[apiKey] Delete failed:", err.message);
      return res.status(500).json({ success: false, message: "Failed to delete API key" });
    }
  },
};

router.post("/", authenticate, requireStore, requireRole(["owner"]), apiKeyController.create);
router.get("/", authenticate, requireStore, apiKeyController.list);
router.put("/:id/revoke", authenticate, requireStore, requireRole(["owner"]), apiKeyController.revoke);
router.delete("/:id", authenticate, requireStore, requireRole(["owner"]), apiKeyController.delete);

module.exports = router;
