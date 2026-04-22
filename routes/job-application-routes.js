const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const controller = require("../controllers/job-application-controller");

router.post("/jobs/:jobId/apply", verifyToken, controller.applyForJob);
router.put("/job-applications/:id", verifyToken, controller.updateMyApplication);
router.put("/job-applications/:id/withdraw", verifyToken, controller.withdrawMyApplication);

router.get("/job-applications/my-applications", verifyToken, controller.getMyApplications);
router.get("/job-applications/:id", verifyToken, controller.getSingleApplication);

router.get("/jobs/:jobId/applications", verifyToken, controller.getApplicationsForJob);
router.put("/job-applications/:id/status", verifyToken, controller.updateApplicationStatus);
router.get("/job-applications/:id/status-history", verifyToken, controller.getApplicationStatusHistory);

module.exports = router;