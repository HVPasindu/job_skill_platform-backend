const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const jobController = require("../controllers/job-controller");

router.post("/", verifyToken, jobController.createJob);
//getalljobs
router.get("/jobsget", jobController.getAllJobs);
router.get("/my-jobs", verifyToken, jobController.getMyJobs);
router.get("/company/:companyId", jobController.getCompanyJobs);
router.get("/:id", jobController.getSingleJob);
router.put("/:id", verifyToken, jobController.updateJob);
router.delete("/:id", verifyToken, jobController.deleteJob);

// PUBLIC (no token required)
router.get("/", jobController.searchJobs);

module.exports = router;