const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { createChatController } = require("../controllers/chatController");
const { authenticate, requireRole } = require("../middleware/authenticate");
const asyncHandler = require("../utils/asyncHandler");
const { CUSTOMER_ROLE } = require("../constants/customerConstants");

function createChatRouter(chatService) {
  const router = express.Router();
  const controller = createChatController(chatService);

  // Each message can call the AI model, so cap how fast one client can send
  const messageLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true",
    message: {
      success: false,
      message: "You're sending messages too quickly. Please wait a moment.",
      code: "CHAT_RATE_LIMITED",
    },
  });

  // Coarse token check; the service re-checks role and status in the database
  router.use(authenticate);
  router.use(requireRole(CUSTOMER_ROLE));

  router.post("/sessions", asyncHandler(controller.start));
  router.get("/sessions/:sessionId", asyncHandler(controller.get));
  router.post("/sessions/:sessionId/messages", messageLimiter, asyncHandler(controller.sendMessage));
  router.post("/sessions/:sessionId/escalate", asyncHandler(controller.escalate));
  router.post("/sessions/:sessionId/resolve", asyncHandler(controller.resolve));

  return router;
}

module.exports = { createChatRouter };
