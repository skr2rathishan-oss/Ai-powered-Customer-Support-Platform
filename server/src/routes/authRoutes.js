const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { createAuthController } = require("../controllers/authController");
const { authenticate } = require("../middleware/authenticate");
const {
  validateSignInRequest,
  validateCompanyRegistrationRequest,
  validateCustomerRegistrationRequest,
  validateForgotPasswordRequest,
  validateResetPasswordRequest,
} = require("../middleware/validateRequest");
const asyncHandler = require("../utils/asyncHandler");
const defaultPassport = require("passport");
const { isGoogleOAuthConfigured } = require("../config/googleOAuth");
const { clientRedirect } = require("../utils/clientRedirect");

function createAuthRouter(authService, dependencies = {}) {
  const router = express.Router();
  const controller = createAuthController(authService);
  const passport = dependencies.passport || defaultPassport;
  const isGoogleConfigured =
    dependencies.isGoogleConfigured || isGoogleOAuthConfigured;

  const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development" || process.env.DISABLE_RATE_LIMIT === "true",
    message: {
      success: false,
      message: "Too many registration attempts. Please try again later.",
      code: "REGISTRATION_RATE_LIMITED",
    },
  });

  const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development" || process.env.DISABLE_RATE_LIMIT === "true",
    message: {
      success: false,
      message: "Too many password reset requests. Please try again later.",
      code: "FORGOT_PASSWORD_RATE_LIMITED",
    },
  });

  const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development" || process.env.DISABLE_RATE_LIMIT === "true",
    message: {
      success: false,
      message: "Too many password reset attempts. Please try again later.",
      code: "RESET_PASSWORD_RATE_LIMITED",
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
  router.post(
    "/customer/register",
    registrationLimiter,
    validateCustomerRegistrationRequest,
    asyncHandler(controller.registerCustomer),
  );
  router.post("/sign-out", asyncHandler(controller.signOut));
  router.get("/me", authenticate, controller.me);

  // Password Reset endpoints
  router.post(
    "/forgot-password",
    forgotPasswordLimiter,
    validateForgotPasswordRequest,
    asyncHandler(controller.forgotPassword),
  );
  router.get(
    "/verify-reset-token",
    asyncHandler(controller.verifyResetToken),
  );
  router.get(
    "/validate-reset-token",
    asyncHandler(controller.verifyResetToken),
  );
  router.post(
    "/reset-password",
    resetPasswordLimiter,
    validateResetPasswordRequest,
    asyncHandler(controller.resetPassword),
  );

  // Which sign-in providers the UI may offer (no secrets).
  router.get("/providers", (_request, response) => {
    response.set("Cache-Control", "no-store");
    return response.status(200).json({
      success: true,
      data: { google: Boolean(isGoogleConfigured()) },
    });
  });

  // Google OAuth 2.0 endpoints (sign-in only for existing accounts)
  router.get(
    "/google",
    (_request, response, next) => {
      if (!isGoogleConfigured()) {
        return clientRedirect(response, "/login", {
          error: "google_not_configured",
        });
      }
      return next();
    },
    (request, response, next) =>
      passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
      })(request, response, next),
  );

  router.get(
    "/google/callback",
    (req, res, next) => {
      if (!isGoogleConfigured()) {
        return clientRedirect(res, "/login", {
          error: "google_not_configured",
        });
      }

      passport.authenticate(
        "google",
        { session: false },
        (err, user, info) => {
          if (err) {
            return clientRedirect(res, "/login", { error: "google_auth_failed" });
          }
          if (!user) {
            // A provider-side failure (for example the user cancelled) carries
            // info; a clean lookup miss does not.
            return clientRedirect(res, "/login", {
              error: info ? "google_auth_failed" : "google_no_account",
            });
          }
          req.user = user;
          next();
        },
      )(req, res, next);
    },
    asyncHandler(controller.googleCallback),
  );

  return router;
}

module.exports = { createAuthRouter };
