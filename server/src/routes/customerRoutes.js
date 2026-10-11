const express = require("express");
const { createCustomerController } = require("../controllers/customerController");
const { authenticate, requireRole } = require("../middleware/authenticate");
const asyncHandler = require("../utils/asyncHandler");
const { CUSTOMER_ROLE } = require("../constants/customerConstants");

function createCustomerRouter(customerService) {
  const router = express.Router();
  const controller = createCustomerController(customerService);

  // Coarse token check; the service re-checks role and status in the database
  router.use(authenticate);
  router.use(requireRole(CUSTOMER_ROLE));

  router.get("/me", asyncHandler(controller.me));
  router.get("/faqs", asyncHandler(controller.listFaqs));
  router.get("/tickets", asyncHandler(controller.listTickets));
  router.post("/tickets", asyncHandler(controller.createTicket));
  router.get("/tickets/:ticketId", asyncHandler(controller.getTicket));

  return router;
}

module.exports = { createCustomerRouter };
