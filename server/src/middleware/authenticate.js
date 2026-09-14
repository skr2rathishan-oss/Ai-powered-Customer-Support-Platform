const { getAuthConfig } = require("../config/auth");
const { verifyAccessToken } = require("../utils/token");

function authenticate(request, response, next) {
  const { cookieName } = getAuthConfig();
  const cookieToken = request.cookies ? request.cookies[cookieName] : null;
  const authHeader = request.headers?.authorization;
  const headerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

  const token = cookieToken || headerToken;

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
    if (
      !request.auth?.accountType ||
      request.auth.accountType.toLowerCase() !== expectedAccountType.toLowerCase()
    ) {
      return response.status(403).json({
        success: false,
        message: "This account cannot access the requested portal",
        code: "ACCOUNT_TYPE_FORBIDDEN",
      });
    }

    return next();
  };
}

function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase().trim());
  return function roleGuard(request, response, next) {
    const userRole = (request.auth?.roleName || "").toLowerCase().trim();
    if (!request.auth || !normalizedAllowed.includes(userRole)) {
      return response.status(403).json({
        success: false,
        message: "Forbidden: This resource requires elevated administrator privileges",
        code: "ROLE_FORBIDDEN",
      });
    }

    return next();
  };
}

module.exports = { authenticate, requireAccountType, requireRole };

