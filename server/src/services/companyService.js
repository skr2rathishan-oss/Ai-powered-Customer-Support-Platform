const defaultCompanyPortalModel = require("../models/companyPortalModel");
const AppError = require("../utils/AppError");

function isStatus(value, expected) {
  return String(value || "").toLowerCase() === expected.toLowerCase();
}

function createCompanyService(dependencies = {}) {
  const portal = dependencies.companyPortalModel || defaultCompanyPortalModel;

  async function getCompanyProfile(auth) {
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

    let supportAgents = 0;
    try {
      const counts = await portal.getCompanyOverviewCounts(context.companyId);
      supportAgents = Number(counts?.supportAgents || 0);
    } catch (_error) {
      supportAgents = 0;
    }

    return {
      user: {
        userId: context.userId,
        firstName: context.firstName,
        lastName: context.lastName,
        email: context.email,
        roleName: context.roleName,
        onlineStatus: context.onlineStatus,
      },
      company: {
        companyId: context.companyId,
        companyName: context.companyName,
        industry: context.industry,
        businessEmail: context.businessEmail,
        phone: context.phone,
        website: context.website,
        description: context.description,
        status: context.companyStatus,
        registrationDate: context.registrationDate,
      },
      overview: {
        openTickets: 0,
        resolvedToday: 0,
        supportAgents,
        faqArticles: 0,
        aiResolutionRate: null,
        avgFirstResponseMinutes: null,
        features: {
          tickets: false,
          agents: false,
          faqs: false,
          aiSettings: false,
        },
      },
    };
  }

  return { getCompanyProfile };
}

module.exports = { createCompanyService };
