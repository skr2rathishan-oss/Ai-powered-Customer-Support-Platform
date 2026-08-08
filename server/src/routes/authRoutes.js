const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { createAuthController } = require("../controllers/authController");
const { authenticate } = require("../middleware/authenticate");
const {
  validateSignInRequest,
  validateCompanyRegistrationRequest,
} = require("../middleware/validateRequest");
const asyncHandler = require("../utils/asyncHandler");

function createAuthRouter(authService) {
  const router = express.Router();
  const controller = createAuthController(authService);
  const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
    message: {
      success: false,
      message: "Too many registration attempts. Please try again later.",
      code: "REGISTRATION_RATE_LIMITED",
    },
  });

  router.post(
    "/sign-in",
    validateSignInRequest,
    asyncHandler(controller.signIn),
  );
  router.post(
    "/company/register",
    registrationLimiter,
    validateCompanyRegistrationRequest,
    asyncHandler(controller.registerCompany),
  );
  router.post("/sign-out", controller.signOut);
  router.get("/me", authenticate, controller.me);

  return router;
}

module.exports = { createAuthRouter };
