const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth-controller");
const verifyToken = require("../middleware/auth-middleware");

router.post("/signup", authController.signup);
router.post("/verify-otp", authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);
router.post("/login", authController.login);

router.post("/become-trainer", verifyToken, authController.becomeTrainer);

module.exports = router;