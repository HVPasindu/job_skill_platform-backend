const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/auth-middleware");
const { uploadCompanyLogo } = require("../middleware/upload");
const companyController = require("../controllers/company-controller");

router.post("/", verifyToken, uploadCompanyLogo, companyController.createCompany);
router.get("/my-companies", verifyToken, companyController.getMyCompanies);
router.get("/:id", verifyToken, companyController.getSingleCompany);
router.put("/:id", verifyToken, uploadCompanyLogo, companyController.updateCompany);

router.post("/:id/add-user", verifyToken, companyController.addUserToCompany);
router.get("/:id/users", verifyToken, companyController.getCompanyUsers);
router.put("/:id/users/:companyUserId", verifyToken, companyController.updateCompanyUser);
router.delete("/:id/users/:companyUserId", verifyToken, companyController.removeCompanyUser);

module.exports = router;