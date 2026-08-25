const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { createAuthController } = require("../controllers/authController");
const { authenticate } = require("../middleware/authenticate");
const {
  validateSignInRequest,
  validateCompanyRegistrationRequest,
} = require("../middleware/validateRequest");
const asyncHandler = require("../utils/asyncHandler");
const defaultPassport = require("passport");

function createAuthRouter(authService, dependencies = {}) {
  const router = express.Router();
  const controller = createAuthController(authService);
  const passport = dependencies.passport || defaultPassport;

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

  // Google OAuth 2.0 endpoints
  router.get(
    "/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false,
    }),
  );

  router.get(
    "/google/callback",
    (req, res, next) => {
      passport.authenticate(
        "google",
        { session: false },
        (err, user) => {
          if (err || !user) {
            const clientOrigin =
              process.env.CLIENT_ORIGIN || "http://localhost:5173";
            return res.redirect(`${clientOrigin}/login?error=google_auth_failed`);
          }
          req.user = user;
          next();
        },
      )(req, res, next);
    },
    controller.googleCallback,
  );

  return router;
}

module.exports = { createAuthRouter };
