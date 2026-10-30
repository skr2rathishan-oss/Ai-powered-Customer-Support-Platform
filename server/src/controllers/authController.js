const { setAuthCookie, clearAuthCookie } = require("../utils/authCookie");
const { createAccessToken } = require("../utils/token");
const { clientRedirect } = require("../utils/clientRedirect");

function createAuthController(authService) {
  // Stored cookie flags; undefined makes the cookie helpers use env config.
  async function cookieOptions() {
    try {
      return authService.getCookieOptions
        ? await authService.getCookieOptions()
        : undefined;
    } catch (_error) {
      return undefined;
    }
  }

  async function signIn(request, response) {
    const { user, accessToken } = await authService.signIn(
      request.validatedBody,
    );

    setAuthCookie(response, accessToken, await cookieOptions());
    response.set("Cache-Control", "no-store");

    return response.status(200).json({
      success: true,
      message: "Sign-in successful",
      data: { user, token: accessToken },
    });
  }

  async function registerCompany(request, response) {
    const { user, accessToken } = await authService.registerCompany(
      request.validatedBody,
    );

    setAuthCookie(response, accessToken, await cookieOptions());
    response.set("Cache-Control", "no-store");

    return response.status(201).json({
      success: true,
      message: "Company registration successful",
      data: { user, token: accessToken },
    });
  }

  async function registerCustomer(request, response) {
    const { user, accessToken } = await authService.registerCustomer(
      request.validatedBody,
    );

    setAuthCookie(response, accessToken, await cookieOptions());
    response.set("Cache-Control", "no-store");

    return response.status(201).json({
      success: true,
      message: "Registration successful",
      data: { user, token: accessToken },
    });
  }

  async function signOut(_request, response) {
    clearAuthCookie(response, await cookieOptions());
    return response.status(200).json({
      success: true,
      message: "Sign-out successful",
    });
  }

  function me(request, response) {
    response.set("Cache-Control", "no-store");
    const user = {
      accountType: request.auth.accountType,
      userId: request.auth.userId,
      email: request.auth.email,
      roleName: request.auth.roleName,
      ...(request.auth.firstName && { firstName: request.auth.firstName }),
      ...(request.auth.lastName && { lastName: request.auth.lastName }),
      ...(request.auth.googleId && { googleId: request.auth.googleId }),
      ...(request.auth.companyId && {
        companyId: request.auth.companyId,
        companyName: request.auth.companyName,
      }),
    };

    return response.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  }

  const GOOGLE_SIGN_IN_ROLES = new Set([
    "Platform Admin",
    "Support Agent",
    "Customer",
  ]);

  async function googleCallback(request, response) {
    const rawUser = request.user;
    if (!rawUser) {
      return clientRedirect(response, "/login", { error: "google_no_account" });
    }

    if (
      rawUser.accountStatus &&
      String(rawUser.accountStatus).toLowerCase() !== "active"
    ) {
      return clientRedirect(response, "/login", { error: "google_inactive" });
    }

    if (!GOOGLE_SIGN_IN_ROLES.has(rawUser.roleName)) {
      return clientRedirect(response, "/login", {
        error: "google_role_unsupported",
      });
    }

    const safeUser = {
      accountType: "individual",
      userId: rawUser.userId || rawUser.id,
      email: rawUser.email,
      ...(rawUser.firstName && { firstName: rawUser.firstName }),
      ...(rawUser.lastName && { lastName: rawUser.lastName }),
      ...(rawUser.googleId && { googleId: rawUser.googleId }),
      onlineStatus: rawUser.onlineStatus || "Offline",
      roleName: rawUser.roleName,
    };

    if (
      authService.isSignInBlockedByMaintenance &&
      (await authService.isSignInBlockedByMaintenance(safeUser.roleName))
    ) {
      return clientRedirect(response, "/login", { error: "maintenance" });
    }

    const accessToken = authService.generateToken
      ? await authService.generateToken(safeUser)
      : createAccessToken(safeUser);

    setAuthCookie(response, accessToken, await cookieOptions());
    response.set("Cache-Control", "no-store");

    return clientRedirect(response, "/auth/callback");
  }

  async function forgotPassword(request, response) {
    const result = await authService.requestPasswordReset(
      request.validatedBody.email,
    );

    return response.status(200).json({
      success: true,
      message: result.message,
      ...(result.resetToken && { resetToken: result.resetToken }),
    });
  }

  async function verifyResetToken(request, response) {
    const token = request.query.token;
    const result = await authService.verifyResetToken(token);

    return response.status(200).json({
      success: true,
      data: result,
    });
  }

  async function resetPassword(request, response) {
    const { token, password } = request.validatedBody;
    const result = await authService.resetPassword(token, password);

    return response.status(200).json({
      success: true,
      message: result.message,
    });
  }

  return {
    signIn,
    registerCompany,
    registerCustomer,
    signOut,
    me,
    googleCallback,
    forgotPassword,
    verifyResetToken,
    resetPassword,
  };
}

module.exports = { createAuthController };
