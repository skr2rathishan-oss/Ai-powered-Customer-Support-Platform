const { getAuthConfig } = require("../config/auth");
const { verifyAccessToken } = require("../utils/token");

const PLATFORM_ADMIN_ROLE = "Platform Admin";

// Always reachable during maintenance. Platform Admins need the admin API and
// sign-in to switch maintenance off; the rest keep the client able to render
// the maintenance state.
function isExempt(request) {
  const path = request.path;

  if (request.method === "OPTIONS") return true;
  if (path === "/health") return true;
  if (path === "/api/admin" || path.startsWith("/api/admin/")) return true;
  if (request.method === "POST" && (path === "/api/auth/sign-in" || path === "/auth/sign-in")) {
    return true;
  }
  if (request.method === "POST" && (path === "/api/auth/sign-out" || path === "/auth/sign-out")) {
    return true;
  }
  if (request.method === "GET" && (path === "/api/auth/providers" || path === "/auth/providers")) {
    return true;
  }
  if (request.method === "GET" && path === "/api/public/platform") return true;
  if (/^\/(api\/)?auth\/google(\/|$)/.test(path)) return true;

  return false;
}

function isPlatformAdminRequest(request) {
  try {
    const { cookieName } = getAuthConfig();
    const authHeader = request.headers?.authorization;
    const token =
      request.cookies?.[cookieName] ||
      (authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null);
    if (!token) return false;
    return verifyAccessToken(token).roleName === PLATFORM_ADMIN_ROLE;
  } catch (_error) {
    return false;
  }
}

/**
 * Rejects non-exempt requests with 503 while maintenance mode is on. Fails
 * open when settings cannot be read.
 */
function createMaintenanceMiddleware(runtimeSettings) {
  return async function maintenanceMiddleware(request, response, next) {
    let maintenanceMode = false;
    try {
      maintenanceMode =
        (await runtimeSettings.get()).infrastructure?.maintenanceMode === true;
    } catch (_error) {
      maintenanceMode = false;
    }

    if (!maintenanceMode || isExempt(request) || isPlatformAdminRequest(request)) {
      return next();
    }

    response.set("Retry-After", "60");
    response.set("Cache-Control", "no-store");
    return response.status(503).json({
      success: false,
      message: "The platform is under maintenance. Please try again shortly.",
      code: "MAINTENANCE_MODE",
    });
  };
}

module.exports = { createMaintenanceMiddleware };
