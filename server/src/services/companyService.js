const defaultCompanyPortalModel = require("../models/companyPortalModel");
const defaultChatModel = require("../models/chatModel");
const { createCompanyContextResolver } = require("./companyContext");

function createCompanyService(dependencies = {}) {
  const portal = dependencies.companyPortalModel || defaultCompanyPortalModel;
  const chatModel = dependencies.chatModel || defaultChatModel;

  // Share of finished AI chats the assistant resolved without a human
  async function getAiResolutionRate(companyId) {
    try {
      const { resolved, escalated } = await chatModel.countOutcomes(companyId);
      const finished = resolved + escalated;
      return finished > 0 ? Math.round((resolved / finished) * 100) : null;
    } catch (_error) {
      return null;
    }
  }
  const { requireActiveCompanyAdmin } = createCompanyContextResolver(portal);

  async function getCompanyProfile(auth) {
    const context = await requireActiveCompanyAdmin(auth);

    let supportAgents = 0;
    let openTickets = 0;
    let resolvedToday = 0;
    let faqArticles = 0;
    let aiConfigured = false;
    try {
      const counts = await portal.getCompanyOverviewCounts(context.companyId);
      supportAgents = Number(counts?.supportAgents || 0);
      openTickets = Number(counts?.openTickets || 0);
      resolvedToday = Number(counts?.resolvedToday || 0);
      faqArticles = Number(counts?.faqArticles || 0);
      aiConfigured = Boolean(counts?.aiConfigured);
    } catch (_error) {
      supportAgents = 0;
      openTickets = 0;
      resolvedToday = 0;
      faqArticles = 0;
      aiConfigured = false;
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
        faqArticles,
        aiConfigured,
        aiResolutionRate: await getAiResolutionRate(context.companyId),
        avgFirstResponseMinutes: null,
        features: {
          tickets: true,
          agents: true,
          faqs: true,
          aiSettings: true,
        },
      },
    };
  }

  return { getCompanyProfile };
}

module.exports = { createCompanyService };
