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

  function signOut(_request, response) {
    clearAuthCookie(response);
    return response.status(200).json({
      success: true,
      message: "Sign-out successful",
    });
  }

  function me(request, response) {
    response.set("Cache-Control", "no-store");
    return response.status(200).json({
      success: true,
      data: {
        user: {
          userId: request.auth.sub,
          email: request.auth.email,
          roleName: request.auth.roleName,
        },
      },
    });
  }

  return { signIn, signOut, me };
}

module.exports = { createAuthController };
