const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const { uploadCourseThumbnail } = require("../middleware/upload");
const optionalAuth = require("../middleware/optional-auth");
const courseReadAccess = require("../middleware/course-read-access");
const browse = require("../controllers/course-browse-controller");
const controller = require("../controllers/course-controller");

router.post("/", verifyToken, uploadCourseThumbnail, controller.createCourse);
router.get("/my-courses", verifyToken, controller.getMyCourses);
router.get("/", browse.getPublicCourses);
router.get("/:id/outline", optionalAuth, courseReadAccess(), browse.getOutline);
router.get("/:id", optionalAuth, courseReadAccess(), controller.getSingleCourse);
router.put("/:id", verifyToken, uploadCourseThumbnail, controller.updateCourse);
router.delete("/:id", verifyToken, controller.deleteCourse);

module.exports = router;