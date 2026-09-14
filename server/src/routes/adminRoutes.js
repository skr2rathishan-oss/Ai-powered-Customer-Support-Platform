const express = require("express");
const { createAdminController } = require("../controllers/adminController");
const { authenticate, requireRole } = require("../middleware/authenticate");
const asyncHandler = require("../utils/asyncHandler");

function createAdminRouter(adminService) {
  const router = express.Router();
  const controller = createAdminController(adminService);

  // Guard all admin routes with authentication and Platform Admin role requirement
  router.get(
    "/dashboard",
    authenticate,
    requireRole("Platform Admin"),
    asyncHandler(controller.getDashboard),
  );
  // Apply authentication and Platform Admin role requirement to all admin routes
  router.use(authenticate);
  router.use(requireRole("Platform Admin"));

  // 1. Platform Dashboard Overview
  router.get("/dashboard", asyncHandler(controller.getDashboard));

  // 2. Companies Management Directory & Actions
  router.get("/companies", asyncHandler(controller.getCompanies));
  router.get("/companies/:id", asyncHandler(controller.getCompany));
  router.patch("/companies/:id/status", asyncHandler(controller.updateCompanyStatus));
  router.delete("/companies/:id", asyncHandler(controller.deleteCompany));

  // 3. Platform Settings & System Diagnostics
  router.get("/settings", asyncHandler(controller.getSettings));
  router.put("/settings", asyncHandler(controller.updateSettings));
  router.post("/settings/test-email", asyncHandler(controller.testEmail));
  router.get("/diagnostics", asyncHandler(controller.getDiagnostics));

  return router;
}

module.exports = { createAdminRouter };

