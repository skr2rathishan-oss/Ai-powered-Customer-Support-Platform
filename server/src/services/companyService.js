const defaultCompanyPortalModel = require("../models/companyPortalModel");
const { createCompanyContextResolver } = require("./companyContext");

function createCompanyService(dependencies = {}) {
  const portal = dependencies.companyPortalModel || defaultCompanyPortalModel;
  const { requireActiveCompanyAdmin } = createCompanyContextResolver(portal);

  async function getCompanyProfile(auth) {
    const context = await requireActiveCompanyAdmin(auth);

    let supportAgents = 0;
    let openTickets = 0;
    let resolvedToday = 0;
    try {
      const counts = await portal.getCompanyOverviewCounts(context.companyId);
      supportAgents = Number(counts?.supportAgents || 0);
      openTickets = Number(counts?.openTickets || 0);
      resolvedToday = Number(counts?.resolvedToday || 0);
    } catch (_error) {
      supportAgents = 0;
      openTickets = 0;
      resolvedToday = 0;
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
        openTickets,
        resolvedToday,
        supportAgents,
        faqArticles: 0,
        aiResolutionRate: null,
        avgFirstResponseMinutes: null,
        features: {
          tickets: true,
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
