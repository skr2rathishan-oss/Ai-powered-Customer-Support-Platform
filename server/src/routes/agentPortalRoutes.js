const express = require("express");
const { createAgentPortalController } = require("../controllers/agentPortalController");
const { authenticate, requireRole } = require("../middleware/authenticate");
const asyncHandler = require("../utils/asyncHandler");
const { AGENT_ROLE } = require("../constants/replyConstants");

function createAgentPortalRouter(service) {
  const router = express.Router();
  const controller = createAgentPortalController(service);

  // Coarse token check; the service re-checks role and status in the database
  router.use(authenticate);
  router.use(requireRole(AGENT_ROLE));

  router.get("/me", asyncHandler(controller.me));
  router.get("/tickets", asyncHandler(controller.listTickets));
  router.get("/tickets/:ticketId", asyncHandler(controller.getTicket));
  router.post("/tickets/:ticketId/replies", asyncHandler(controller.createReply));
  router.patch("/tickets/:ticketId", asyncHandler(controller.updateStatus));

  return router;
}

module.exports = { createAgentPortalRouter };
