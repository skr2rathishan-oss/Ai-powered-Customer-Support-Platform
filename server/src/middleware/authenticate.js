const { getAuthConfig } = require("../config/auth");
const { verifyAccessToken } = require("../utils/token");

function authenticate(request, response, next) {
  const { cookieName } = getAuthConfig();
  const token = request.cookies[cookieName];

  if (!token) {
    return response.status(401).json({
      success: false,
      message: "Authentication required",
      code: "AUTHENTICATION_REQUIRED",
    });
  }

  try {
    request.auth = verifyAccessToken(token);
    return next();
  } catch (_error) {
    return response.status(401).json({
      success: false,
      message: "Invalid or expired session",
      code: "INVALID_SESSION",
    });
  }
}

function requireAccountType(expectedAccountType) {
  return function accountTypeGuard(request, response, next) {
    if (request.auth?.accountType !== expectedAccountType) {
      return response.status(403).json({
        success: false,
        message: "This account cannot access the requested portal",
        code: "ACCOUNT_TYPE_FORBIDDEN",
      });
    }

    return next();
  };
}

module.exports = { authenticate, requireAccountType };
