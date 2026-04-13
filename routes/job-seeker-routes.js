const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const { uploadProfileImage } = require("../middleware/upload");
const jobSeekerController = require("../controllers/job-seeker-controller");


// profile
router.post("/profile", verifyToken, uploadProfileImage, jobSeekerController.createProfile);
router.get("/profile", verifyToken, jobSeekerController.getProfile);
router.put("/profile", verifyToken, uploadProfileImage, jobSeekerController.updateProfile);


// education
router.post("/education", verifyToken, jobSeekerController.addEducation);
router.get("/education", verifyToken, jobSeekerController.getEducations);
router.put("/education/:id", verifyToken, jobSeekerController.updateEducation);
router.delete("/education/:id", verifyToken, jobSeekerController.deleteEducation);

// experience
router.post("/experience", verifyToken, jobSeekerController.addExperience);
router.get("/experience", verifyToken, jobSeekerController.getExperiences);
router.put("/experience/:id", verifyToken, jobSeekerController.updateExperience);
router.delete("/experience/:id", verifyToken, jobSeekerController.deleteExperience);

//skill
router.post("/skills", verifyToken, jobSeekerController.addSkill);
router.get("/skills", verifyToken, jobSeekerController.getSkills);
router.put("/skills/:id", verifyToken, jobSeekerController.updateSkill);
router.delete("/skills/:id", verifyToken, jobSeekerController.deleteSkill);

module.exports = router;