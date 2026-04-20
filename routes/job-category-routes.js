const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const requireAdmin = require("../middleware/require-admin");
const jobCategoryController = require("../controllers/job-category-controller");

router.post("/", verifyToken, requireAdmin, jobCategoryController.addCategory);
router.get("/", jobCategoryController.getAllCategories);
router.get("/:id", jobCategoryController.getSingleCategory);
router.put("/:id", verifyToken, requireAdmin, jobCategoryController.updateCategory);
router.delete("/:id", verifyToken, requireAdmin, jobCategoryController.deleteCategory);

module.exports = router;