const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const { uploadCourseThumbnail } = require("../middleware/upload");
const controller = require("../controllers/course-controller");

router.post("/", verifyToken, uploadCourseThumbnail, controller.createCourse);
router.get("/my-courses", verifyToken, controller.getMyCourses);
router.get("/:id", controller.getSingleCourse);
router.put("/:id", verifyToken, uploadCourseThumbnail, controller.updateCourse);
router.delete("/:id", verifyToken, controller.deleteCourse);

module.exports = router;