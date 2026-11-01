const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const requireAdmin = require("../middleware/require-admin");
const controller = require("../controllers/chatbot-controller");
const optionalAuth = require("../middleware/optional-auth");

router.post("/ask",optionalAuth, controller.askChatbot);

// admin only
router.get("/logs", verifyToken, requireAdmin, controller.getChatbotLogs);

module.exports = router;