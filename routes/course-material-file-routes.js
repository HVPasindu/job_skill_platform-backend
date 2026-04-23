const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const { uploadCourseMaterialFiles } = require("../middleware/upload");
const controller = require("../controllers/course-material-file-controller");

router.post("/:materialId/files", verifyToken, uploadCourseMaterialFiles, controller.addMaterialFiles);
router.get("/:materialId/files", controller.getMaterialFiles);
router.put("/files/:fileId", verifyToken, uploadCourseMaterialFiles, controller.updateMaterialFile);
router.delete("/files/:fileId", verifyToken, controller.deleteMaterialFile);

module.exports = router;