const express = require("express");
const { createFaqController } = require("../controllers/faqController");
const { authenticate, requireRole } = require("../middleware/authenticate");
const asyncHandler = require("../utils/asyncHandler");

function createFaqRouter(faqService) {
  const router = express.Router();
  const controller = createFaqController(faqService);

  router.use(authenticate);
  router.use(requireRole("Company Admin"));

  router.get("/", asyncHandler(controller.list));
  router.post("/", asyncHandler(controller.create));
  router.patch("/:faqId", asyncHandler(controller.update));
  router.delete("/:faqId", asyncHandler(controller.remove));

  return router;
}

module.exports = { createFaqRouter };
