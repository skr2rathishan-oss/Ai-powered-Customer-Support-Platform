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

  return router;
}

module.exports = { createAdminRouter };

