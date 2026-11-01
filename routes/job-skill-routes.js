const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const controller = require("../controllers/job-skill-controller");

router.post("/:jobId/skills", verifyToken, controller.addJobSkill);
router.get("/:jobId/skills", controller.getJobSkills);
router.put("/:jobId/skills/:skillId", verifyToken, controller.updateJobSkill);
router.delete("/:jobId/skills/:skillId", verifyToken, controller.deleteJobSkill);

module.exports = router;