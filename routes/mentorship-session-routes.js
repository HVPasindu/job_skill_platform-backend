const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const optionalAuth = require("../middleware/optional-auth");
const controller = require("../controllers/mentorship-session-controller");

router.post("/", verifyToken, controller.createMentorshipSession);
router.get("/", optionalAuth, controller.getAllMentorshipSessions);
router.get("/my-sessions", verifyToken, controller.getMyMentorshipSessions);
router.get("/:id", optionalAuth, controller.getSingleMentorshipSession);
router.put("/:id", verifyToken, controller.updateMentorshipSession);
router.delete("/:id", verifyToken, controller.deleteMentorshipSession);

module.exports = router;