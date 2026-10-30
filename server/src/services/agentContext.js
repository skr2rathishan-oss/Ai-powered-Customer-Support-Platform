const AppError = require("../utils/AppError");
const { AGENT_ROLE } = require("../constants/replyConstants");

function isStatus(value, expected) {
  return String(value || "").toLowerCase() === expected.toLowerCase();
}

/**
 * Resolves and verifies the agent and company a request acts for. Both come
 * from the database only, so a deactivated agent with a live token is blocked.
 */
function createAgentContextResolver(agentModel) {
  async function requireActiveAgent(auth) {
    const userId = Number(auth?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError("Authentication required", 401, "AUTHENTICATION_REQUIRED");
    }

    const context = await agentModel.findAgentContext(userId);
    if (!context) {
      throw new AppError(
        "No company is associated with this account",
        403,
        "COMPANY_ACCESS_DENIED",
      );
    }

    if (!isStatus(context.roleName, AGENT_ROLE)) {
      throw new AppError(
        "Forbidden: This resource requires a support agent account",
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

  return { requireActiveAgent };
}

module.exports = { createAgentContextResolver };
