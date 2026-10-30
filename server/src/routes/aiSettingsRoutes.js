const express = require("express");
const { createAiSettingsController } = require("../controllers/aiSettingsController");
const { authenticate, requireRole } = require("../middleware/authenticate");
const asyncHandler = require("../utils/asyncHandler");

function createAiSettingsRouter(aiSettingsService) {
  const router = express.Router();
  const controller = createAiSettingsController(aiSettingsService);

  router.use(authenticate);
  router.use(requireRole("Company Admin"));

  router.get("/", asyncHandler(controller.get));
  router.put("/", asyncHandler(controller.update));

  return router;
}

module.exports = { createAiSettingsRouter };
