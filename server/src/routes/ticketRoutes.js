const express = require("express");
const { createTicketController } = require("../controllers/ticketController");
const { authenticate, requireRole } = require("../middleware/authenticate");
const asyncHandler = require("../utils/asyncHandler");

function createTicketRouter(ticketService) {
  const router = express.Router();
  const controller = createTicketController(ticketService);

  router.use(authenticate);
  router.use(requireRole("Company Admin"));

  // Static path first so it is not captured by /:ticketId
  router.get("/assignable-agents", asyncHandler(controller.listAgents));
  router.get("/stats", asyncHandler(controller.stats));
  router.get("/", asyncHandler(controller.list));
  router.post("/", asyncHandler(controller.create));
  router.get("/:ticketId", asyncHandler(controller.get));
  router.get("/:ticketId/replies", asyncHandler(controller.listReplies));
  router.post("/:ticketId/replies", asyncHandler(controller.createReply));
  router.patch("/:ticketId", asyncHandler(controller.update));

  return router;
}

module.exports = { createTicketRouter };
