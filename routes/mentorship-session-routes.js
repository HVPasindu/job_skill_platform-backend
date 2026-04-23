const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const controller = require("../controllers/mentorship-session-controller");

router.post("/", verifyToken, controller.createMentorshipSession);
router.get("/", controller.getAllMentorshipSessions);
router.get("/my-sessions", verifyToken, controller.getMyMentorshipSessions);
router.get("/:id", controller.getSingleMentorshipSession);
router.put("/:id", verifyToken, controller.updateMentorshipSession);
router.delete("/:id", verifyToken, controller.deleteMentorshipSession);

module.exports = router;