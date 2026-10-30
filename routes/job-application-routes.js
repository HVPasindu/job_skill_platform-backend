const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const requireJobSeeker = require("../middleware/require-job-seeker");
const controller = require("../controllers/job-application-controller");

router.post(
  "/jobs/:jobId/apply",
  verifyToken,
  requireJobSeeker,
  controller.applyForJob,
);
router.put(
  "/job-applications/:id",
  verifyToken,
  requireJobSeeker,
  controller.updateMyApplication,
);
router.put(
  "/job-applications/:id/withdraw",
  verifyToken,
  requireJobSeeker,
  controller.withdrawMyApplication,
);

router.get(
  "/job-applications/my-applications",
  verifyToken,
  requireJobSeeker,
  controller.getMyApplications,
);
router.get(
  "/job-applications/:id",
  verifyToken,
  requireJobSeeker,
  controller.getSingleApplication,
);

router.get(
  "/jobs/:jobId/applications",
  verifyToken,
  controller.getApplicationsForJob,
);
router.put(
  "/job-applications/:id/status",
  verifyToken,
  controller.updateApplicationStatus,
);
router.get(
  "/job-applications/:id/status-history",
  verifyToken,
  controller.getApplicationStatusHistory,
);

module.exports = router;
