const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const controller = require("../controllers/course-category-controller");

// create (trainer / admin)
router.post("/", verifyToken, controller.createCourseCategory);

// get all (public)
router.get("/", controller.getAllCourseCategories);

module.exports = router;