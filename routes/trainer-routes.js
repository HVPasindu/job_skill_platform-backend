const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const { uploadProfileImage } = require("../middleware/upload");
const trainerController = require("../controllers/trainer-controller");

router.post("/profile", verifyToken, uploadProfileImage, trainerController.createTrainerProfile);
router.get("/profile", verifyToken, trainerController.getMyTrainerProfile);
router.put("/profile", verifyToken, uploadProfileImage, trainerController.updateTrainerProfile);

module.exports = router;