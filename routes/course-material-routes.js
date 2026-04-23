const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const controller = require("../controllers/course-material-controller");

router.post("/:courseId/materials", verifyToken, controller.createCourseMaterial);

router.get("/:courseId/materials", controller.getCourseMaterials);
router.get("/materials/:materialId", controller.getSingleCourseMaterial);

router.put("/materials/:materialId", verifyToken, controller.updateCourseMaterial);
router.delete("/materials/:materialId", verifyToken, controller.deleteCourseMaterial);

module.exports = router;