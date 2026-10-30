const AppError = require("../utils/AppError");

function isStatus(value, expected) {
  return String(value || "").toLowerCase() === expected.toLowerCase();
}

/**
 * Resolves and verifies the company a Company Admin acts for. The company comes
 * from the database only, never from the token, body, query or params.
 */
function createCompanyContextResolver(portal) {
  async function requireActiveCompanyAdmin(auth) {
    const userId = Number(auth?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
    }

    const context = await portal.findCompanyAdminContext(userId);
    if (!context) {
      throw new AppError(
        "No company is associated with this account",
        403,
        "COMPANY_ACCESS_DENIED",
      );
    }

    if (!isStatus(context.roleName, "Company Admin")) {
      throw new AppError(
        "Forbidden: This resource requires company administrator privileges",
        403,
        "ROLE_FORBIDDEN",
      );
    }

    if (!isStatus(context.userStatus, "Active")) {
      throw new AppError("This account is not active", 403, "ACCOUNT_INACTIVE");
    }

    if (!isStatus(context.companyStatus, "Active")) {
      throw new AppError("This company is not active", 403, "COMPANY_INACTIVE");
    }

    return context;
  }

  return { requireActiveCompanyAdmin };
}

module.exports = { createCompanyContextResolver };
