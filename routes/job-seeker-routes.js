const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const { uploadProfileImage } = require("../middleware/upload");
const jobSeekerController = require("../controllers/job-seeker-controller");

router.post("/profile", verifyToken, uploadProfileImage, jobSeekerController.createProfile);
router.get("/profile", verifyToken, jobSeekerController.getProfile);
router.put("/profile", verifyToken, uploadProfileImage, jobSeekerController.updateProfile);

module.exports = router;