const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const controller = require("../controllers/course-enrollment-controller");

router.post("/courses/:courseId/enroll", verifyToken, controller.enrollInCourse);

router.get("/course-enrollments/my-enrollments", verifyToken, controller.getMyEnrollments);
router.get("/course-enrollments/:id", verifyToken, controller.getSingleEnrollment);
router.put("/course-enrollments/:id/cancel", verifyToken, controller.cancelEnrollment);

router.get("/courses/:courseId/enrollments", verifyToken, controller.getCourseEnrollmentsForTrainer);
router.put("/course-enrollments/:id/complete", verifyToken, controller.markEnrollmentCompleted);

module.exports = router;