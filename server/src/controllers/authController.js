const { setAuthCookie, clearAuthCookie } = require("../utils/authCookie");
const { createAccessToken } = require("../utils/token");

function createAuthController(authService) {
  async function signIn(request, response) {
    const { user, accessToken } = await authService.signIn(
      request.validatedBody,
    );

    setAuthCookie(response, accessToken);
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

    setAuthCookie(response, accessToken);
    response.set("Cache-Control", "no-store");

    return response.status(201).json({
      success: true,
      message: "Company registration successful",
      data: { user, token: accessToken },
    });
  }

  function signOut(_request, response) {
    clearAuthCookie(response);
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

  function googleCallback(request, response) {
    const rawUser = request.user;
    if (!rawUser) {
      const clientOrigin =
        process.env.CLIENT_ORIGIN || "http://localhost:5173";
      return response.redirect(`${clientOrigin}/login?error=google_auth_failed`);
    }

    const safeUser = {
      accountType: "individual",
      userId: rawUser.userId || rawUser.id,
      email: rawUser.email,
      ...(rawUser.firstName && { firstName: rawUser.firstName }),
      ...(rawUser.lastName && { lastName: rawUser.lastName }),
      ...(rawUser.googleId && { googleId: rawUser.googleId }),
      onlineStatus: rawUser.onlineStatus || "Offline",
      roleName: rawUser.roleName || "Agent",
    };

    const accessToken = authService.generateToken
      ? authService.generateToken(safeUser)
      : createAccessToken(safeUser);

    setAuthCookie(response, accessToken);
    response.set("Cache-Control", "no-store");

    const clientOrigin =
      process.env.CLIENT_ORIGIN || "http://localhost:5173";
    return response.redirect(`${clientOrigin}/login?authenticated=true`);
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
    signOut,
    me,
    googleCallback,
    forgotPassword,
    verifyResetToken,
    resetPassword,
  };
}

module.exports = { createAuthController };
