const express = require("express");
const { createAuthController } = require("../controllers/authController");
const { authenticate } = require("../middleware/authenticate");
const { validateSignInRequest } = require("../middleware/validateRequest");
const asyncHandler = require("../utils/asyncHandler");

function createAuthRouter(authService) {
  const router = express.Router();
  const controller = createAuthController(authService);

  router.post(
    "/sign-in",
    validateSignInRequest,
    asyncHandler(controller.signIn),
  );
  router.post("/sign-out", controller.signOut);
  router.get("/me", authenticate, controller.me);

  return router;
}

module.exports = { createAuthRouter };

