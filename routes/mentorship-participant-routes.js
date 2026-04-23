const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const controller = require("../controllers/mentorship-participant-controller");

// join
router.post("/sessions/:sessionId/join", verifyToken, controller.joinSession);

// my sessions
router.get("/my-sessions", verifyToken, controller.getMySessions);

// leave
router.delete("/sessions/:sessionId/leave", verifyToken, controller.leaveSession);

// trainer view participants
router.get("/sessions/:sessionId/participants", verifyToken, controller.getParticipants);

module.exports = router;