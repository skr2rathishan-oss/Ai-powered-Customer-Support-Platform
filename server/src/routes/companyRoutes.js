const express = require("express");
const { createCompanyController } = require("../controllers/companyController");
const { authenticate, requireRole } = require("../middleware/authenticate");
const asyncHandler = require("../utils/asyncHandler");

function createCompanyRouter(companyService) {
  const router = express.Router();
  const controller = createCompanyController(companyService);

  router.use(authenticate);
  router.use(requireRole("Company Admin"));

  router.get("/me", asyncHandler(controller.getMe));

  return router;
}

module.exports = { createCompanyRouter };
