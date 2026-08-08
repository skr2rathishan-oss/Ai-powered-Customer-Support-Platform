const { setAuthCookie, clearAuthCookie } = require("../utils/authCookie");

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
      data: { user },
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
      data: { user },
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

  return { signIn, registerCompany, signOut, me };
}

module.exports = { createAuthController };
