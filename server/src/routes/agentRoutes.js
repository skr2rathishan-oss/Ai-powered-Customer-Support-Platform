const express = require("express");
const { createAgentController } = require("../controllers/agentController");
const { authenticate, requireRole } = require("../middleware/authenticate");
const asyncHandler = require("../utils/asyncHandler");

function createAgentRouter(agentService) {
  const router = express.Router();
  const controller = createAgentController(agentService);

  router.use(authenticate);
  router.use(requireRole("Company Admin"));

  router.get("/", asyncHandler(controller.list));
  router.post("/", asyncHandler(controller.invite));
  router.post("/:agentId/resend-invite", asyncHandler(controller.resendInvite));
  router.patch("/:agentId", asyncHandler(controller.updateStatus));

  return router;
}

module.exports = { createAgentRouter };
