const AppError = require("../utils/AppError");
const { CUSTOMER_ROLE } = require("../constants/customerConstants");

function isStatus(value, expected) {
  return String(value || "").toLowerCase() === expected.toLowerCase();
}

/**
 * Resolves and verifies the customer and company a request acts for. Both come
 * from the database only, never from the token, body, query or params.
 */
function createCustomerContextResolver(customerModel) {
  async function requireActiveCustomer(auth) {
    const userId = Number(auth?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
    }

    const context = await customerModel.findCustomerContext(userId);
    if (!context) {
      throw new AppError(
        "No company is associated with this account",
        403,
        "COMPANY_ACCESS_DENIED",
      );
    }

    if (!isStatus(context.roleName, CUSTOMER_ROLE)) {
      throw new AppError(
        "Forbidden: This resource requires a customer account",
        403,
        "ROLE_FORBIDDEN",
      );
    }

    if (!isStatus(context.userStatus, "Active")) {
      throw new AppError("This account is not active", 403, "ACCOUNT_INACTIVE");
    }

    if (!isStatus(context.companyStatus, "Active")) {
      throw new AppError(
        "This company is not accepting support requests",
        403,
        "COMPANY_INACTIVE",
      );
    }

    return context;
  }

  return { requireActiveCustomer };
}

module.exports = { createCustomerContextResolver };
