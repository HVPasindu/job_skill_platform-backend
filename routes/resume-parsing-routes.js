const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const controller = require("../controllers/resume-parsing-controller");

router.post("/parse-auto", verifyToken, controller.parseAutoResume);
router.post("/:resumeId/parse", verifyToken, controller.parseResume);
router.get("/:resumeId/parse-result", verifyToken, controller.getResumeParseResult);

module.exports = router;