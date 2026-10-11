/**
 * Development-only mock backend. Serves the real Express app wired to in-memory
 * models so the UI can be exercised without MySQL, MongoDB or a .env file.
 *
 *   npm run mock
 *
 * Never connects to a database and never reads .env.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "mock-server-secret-that-is-longer-than-32-chars";
process.env.JWT_COOKIE_SECURE = "false";
process.env.PORT = process.env.PORT || "5000";

const bcrypt = require("bcrypt");
const { createApp } = require("../src/app");

const PLATFORM_ADMIN_PASSWORD = "Admin@SupportPilot2026!";
const COMPANY_ADMIN_PASSWORD = "CompanyAdmin@2026!";

async function buildMockApp() {
  const adminHash = await bcrypt.hash(PLATFORM_ADMIN_PASSWORD, 4);
  const companyHash = await bcrypt.hash(COMPANY_ADMIN_PASSWORD, 4);

  const companies = [
    {
      companyId: 1,
      companyName: "Acme Demo Co",
      industry: "Technology",
      businessEmail: "owner@acme-demo.com",
      phone: "+1 555 0100",
      website: "https://acme-demo.example",
      description: "Demo tenant for the company portal.",
      status: "Active",
      registrationDate: "2026-01-15T09:00:00.000Z",
    },
    {
      companyId: 2,
      companyName: "Globex",
      industry: "Retail",
      businessEmail: "owner@globex.example",
      phone: null,
      website: null,
      description: null,
      status: "Active",
      registrationDate: "2026-03-02T09:00:00.000Z",
    },
  ];

  const users = [
    {
      userId: 1, companyId: null, firstName: "Platform", lastName: "Admin",
      email: "admin@supportpilot.com", passwordHash: adminHash,
      onlineStatus: "Online", accountStatus: "Active", roleName: "Platform Admin",
    },
    {
      userId: 2, companyId: 1, firstName: "Ada", lastName: "Owner",
      email: "owner@acme-demo.com", passwordHash: companyHash,
      onlineStatus: "Online", accountStatus: "Active", roleName: "Company Admin",
    },
    {
      userId: 3, companyId: 2, firstName: "Gus", lastName: "Globex",
      email: "owner@globex.example", passwordHash: companyHash,
      onlineStatus: "Offline", accountStatus: "Active", roleName: "Company Admin",
    },
    {
      userId: 4, companyId: 1, firstName: "Sam", lastName: "Agent",
      email: "agent@acme-demo.com", passwordHash: companyHash,
      onlineStatus: "Offline", accountStatus: "Active", roleName: "Support Agent",
    },
    {
      userId: 5, companyId: 2, firstName: "Gina", lastName: "Globex",
      email: "agent@globex.example", passwordHash: companyHash,
      onlineStatus: "Online", accountStatus: "Active", roleName: "Support Agent",
    },
    {
      userId: 6, companyId: 1, firstName: "Riya", lastName: "Patel",
      email: "riya@acme-demo.com", passwordHash: companyHash,
      onlineStatus: "Online", accountStatus: "Active", roleName: "Support Agent",
    },
    {
      userId: 7, companyId: 1, firstName: "Dev", lastName: "Inactive",
      email: "dev@acme-demo.com", passwordHash: companyHash,
      onlineStatus: "Offline", accountStatus: "Inactive", roleName: "Support Agent",
    },
    {
      userId: 8, companyId: 1, firstName: "Nia", lastName: "Pending",
      email: "nia@acme-demo.com", passwordHash: null,
      onlineStatus: "Offline", accountStatus: "Active", roleName: "Support Agent",
    },
  ];
  let nextUserId = 9;

  const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
  let nextTicketId = 12;
  const tickets = [
    { ticketId: 1, companyId: 1, subject: "Cannot reset my password", description: "The reset email never arrives.", status: "Open", priority: "High", assignedAgentId: 4, requesterName: "Priya Nair", requesterEmail: "priya@example.com", createdAt: daysAgo(1), resolvedAt: null },
    { ticketId: 2, companyId: 1, subject: "Invoice shows wrong amount", description: "March invoice is double the plan price.", status: "In Progress", priority: "Urgent", assignedAgentId: 4, requesterName: "Tom Becker", requesterEmail: "tom@example.com", createdAt: daysAgo(2), resolvedAt: null },
    { ticketId: 3, companyId: 1, subject: "Feature request: dark mode", description: "Please add a dark theme to the dashboard.", status: "Open", priority: "Low", assignedAgentId: null, requesterName: "Lena Ortiz", requesterEmail: "lena@example.com", createdAt: daysAgo(3), resolvedAt: null },
    { ticketId: 4, companyId: 1, subject: "Login page shows error 500", description: "Intermittent server error on sign in.", status: "Open", priority: "Urgent", assignedAgentId: null, requesterName: null, requesterEmail: null, createdAt: daysAgo(0), resolvedAt: null },
    { ticketId: 5, companyId: 1, subject: "How do I export my data?", description: "Looking for a CSV export option.", status: "Resolved", priority: "Medium", assignedAgentId: null, requesterName: "Omar Haddad", requesterEmail: "omar@example.com", createdAt: daysAgo(1), resolvedAt: new Date().toISOString() },
    { ticketId: 6, companyId: 1, subject: "Account upgrade question", description: "What is included in the Pro plan?", status: "Closed", priority: "Low", assignedAgentId: null, requesterName: "Mia Chen", requesterEmail: "mia@example.com", createdAt: daysAgo(9), resolvedAt: daysAgo(8) },
    { ticketId: 7, companyId: 1, subject: "Widget not loading on Safari", description: "Chat widget is blank on Safari 17.", status: "In Progress", priority: "Medium", assignedAgentId: null, requesterName: "Jon Park", requesterEmail: "jon@example.com", createdAt: daysAgo(4), resolvedAt: null },
    { ticketId: 8, companyId: 1, subject: "Change billing email", description: "Please update our billing contact.", status: "Open", priority: "Medium", assignedAgentId: null, requesterName: "Eve Stone", requesterEmail: "eve@example.com", createdAt: daysAgo(5), resolvedAt: null },
    { ticketId: 9, companyId: 2, subject: "Order arrived damaged", description: "Box was crushed on arrival.", status: "Open", priority: "High", assignedAgentId: 5, requesterName: "Rae Fox", requesterEmail: "rae@example.com", createdAt: daysAgo(1), resolvedAt: null },
    { ticketId: 10, companyId: 2, subject: "Where is my refund?", description: "Refund requested two weeks ago.", status: "Open", priority: "Medium", assignedAgentId: null, requesterName: "Ian Cole", requesterEmail: "ian@example.com", createdAt: daysAgo(2), resolvedAt: null },
    { ticketId: 11, companyId: 1, subject: "Old shipping inquiry", description: "Resolved by a former agent.", status: "Resolved", priority: "Low", assignedAgentId: 7, requesterName: "Zed Hall", requesterEmail: "zed@example.com", createdAt: daysAgo(12), resolvedAt: daysAgo(11) },
  ].map((ticket) => ({ customerId: null, updatedAt: ticket.createdAt, ...ticket }));

  const isClosed = (status) => status === "Resolved" || status === "Closed";
  const isSameDay = (iso) => new Date(iso).toDateString() === new Date().toDateString();

  const presentTicket = (ticket) => {
    const agent = users.find(
      (u) => u.userId === ticket.assignedAgentId && u.companyId === ticket.companyId,
    );
    return {
      ...ticket,
      assigneeName: agent ? `${agent.firstName} ${agent.lastName}`.trim() : null,
    };
  };

  const isAssignableAgent = (u, companyId) =>
    u.companyId === Number(companyId) &&
    u.roleName === "Support Agent" &&
    u.accountStatus === "Active";

  const ticketModel = {
    createTicket: async (companyId, input) => {
      const now = new Date().toISOString();
      const ticket = {
        ticketId: nextTicketId++,
        companyId: Number(companyId),
        customerId: input.customerId ?? null,
        requesterName: input.requesterName ?? null,
        requesterEmail: input.requesterEmail ?? null,
        subject: input.subject,
        description: input.description,
        status: input.status,
        priority: input.priority,
        assignedAgentId: input.assignedAgentId ?? null,
        createdAt: now,
        updatedAt: now,
        resolvedAt: isClosed(input.status) ? now : null,
      };
      tickets.push(ticket);
      return presentTicket(ticket);
    },
    findTicketById: async (companyId, ticketId) => {
      const ticket = tickets.find(
        (t) => t.companyId === Number(companyId) && t.ticketId === Number(ticketId),
      );
      return ticket ? presentTicket(ticket) : null;
    },
    listTickets: async (companyId, filters = {}) => {
      const term = filters.search ? filters.search.toLowerCase() : null;
      const matches = tickets
        .filter((t) => t.companyId === Number(companyId))
        .filter((t) => !filters.status || t.status === filters.status)
        .filter((t) => !filters.priority || t.priority === filters.priority)
        .filter((t) => {
          if (filters.unassigned) return t.assignedAgentId === null;
          if (filters.assigneeId) return t.assignedAgentId === filters.assigneeId;
          return true;
        })
        .filter(
          (t) =>
            !term ||
            [t.subject, t.requesterName, t.requesterEmail].some(
              (field) => field && field.toLowerCase().includes(term),
            ),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.ticketId - a.ticketId);
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      return {
        tickets: matches.slice((page - 1) * limit, page * limit).map(presentTicket),
        total: matches.length,
        page,
        limit,
      };
    },
    updateTicket: async (companyId, ticketId, changes = {}) => {
      const ticket = tickets.find(
        (t) => t.companyId === Number(companyId) && t.ticketId === Number(ticketId),
      );
      if (!ticket) return null;
      if (changes.status !== undefined) {
        ticket.status = changes.status;
        ticket.resolvedAt = isClosed(changes.status)
          ? ticket.resolvedAt || new Date().toISOString()
          : null;
      }
      if (changes.priority !== undefined) ticket.priority = changes.priority;
      if (changes.assignedAgentId !== undefined) {
        ticket.assignedAgentId = changes.assignedAgentId;
      }
      ticket.updatedAt = new Date().toISOString();
      return presentTicket(ticket);
    },
    findAssignableAgent: async (companyId, agentId) => {
      const agent = users.find(
        (u) => u.userId === Number(agentId) && isAssignableAgent(u, companyId),
      );
      return agent
        ? { userId: agent.userId, firstName: agent.firstName, lastName: agent.lastName, email: agent.email }
        : null;
    },
    listAssignableAgents: async (companyId) =>
      users
        .filter((u) => isAssignableAgent(u, companyId))
        .map((u) => ({
          userId: u.userId,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          onlineStatus: u.onlineStatus,
        })),
  };

  const findUser = (email) =>
    users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim()) || null;

  const userModel = {
    findByEmail: async (email) => findUser(email),
    findByGoogleId: async () => null,
    linkGoogleAccount: async () => {},
    setPassword: async (userId, passwordHash) => {
      const user = users.find((u) => u.userId === Number(userId));
      if (user) user.passwordHash = passwordHash;
    },
    findOrCreate: async (_data, callback) => callback && callback(new Error("Not supported in mock"), null),
  };

  const companyModel = {
    findByBusinessEmail: async (email) => {
      const clean = String(email).toLowerCase().trim();
      const company = companies.find((c) => c.businessEmail.toLowerCase() === clean);
      const admin = company
        ? users.find((u) => u.companyId === company.companyId && u.roleName === "Company Admin")
        : users.find((u) => u.email.toLowerCase() === clean && u.roleName === "Company Admin");
      if (!admin) return null;
      const owned = companies.find((c) => c.companyId === admin.companyId);
      return {
        userId: admin.userId,
        companyId: owned.companyId,
        companyName: owned.companyName,
        email: owned.businessEmail,
        passwordHash: admin.passwordHash,
        onlineStatus: admin.onlineStatus,
        accountStatus: admin.accountStatus,
        companyStatus: owned.status,
        roleName: admin.roleName,
      };
    },
    createRegistration: async () => {
      throw new Error("Registration is not available in the mock server");
    },
  };

  const resetTokens = [];
  let nextTokenId = 1;
  const tokenModel = {
    createPasswordResetToken: async (userId, tokenHash, expiresAt) => {
      const tokenId = nextTokenId++;
      resetTokens.push({ tokenId, userId, tokenHash, expiresAt, used: 0, usedAt: null });
      return tokenId;
    },
    findTokenByHash: async (tokenHash) => {
      const token = resetTokens.find((t) => t.tokenHash === tokenHash);
      if (!token) return null;
      const user = users.find((u) => u.userId === token.userId);
      return { ...token, email: user?.email, accountStatus: user?.accountStatus };
    },
    findValidToken: async (tokenHash) => {
      const token = resetTokens.find((t) => t.tokenHash === tokenHash);
      return token && !token.used && new Date(token.expiresAt) > new Date() ? token : null;
    },
    markTokenUsed: async (tokenId) => {
      const token = resetTokens.find((t) => t.tokenId === tokenId);
      if (token) Object.assign(token, { used: 1, usedAt: new Date().toISOString() });
    },
    invalidateUserTokens: async (userId) => {
      for (const token of resetTokens) {
        if (token.userId === Number(userId) && !token.used) {
          Object.assign(token, { used: 1, usedAt: new Date().toISOString() });
        }
      }
    },
  };

  const isOpenTicket = (t) => t.status === "Open" || t.status === "In Progress";
  const isAgentRow = (u, companyId) =>
    u.companyId === Number(companyId) && u.roleName === "Support Agent";
  const presentAgent = (u, companyId) => ({
    agentId: u.userId,
    firstName: u.firstName,
    lastName: u.lastName,
    name: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
    status: u.accountStatus,
    onlineStatus: u.onlineStatus,
    invitePending: !u.passwordHash && !u.googleId,
    openTickets: tickets.filter(
      (t) => t.companyId === Number(companyId) && t.assignedAgentId === u.userId && isOpenTicket(t),
    ).length,
  });

  const agentModel = {
    listAgents: async (companyId) =>
      users
        .filter((u) => isAgentRow(u, companyId))
        .sort(
          (a, b) =>
            a.accountStatus.localeCompare(b.accountStatus) ||
            a.firstName.localeCompare(b.firstName) ||
            a.lastName.localeCompare(b.lastName),
        )
        .map((u) => presentAgent(u, companyId)),
    findAgent: async (companyId, agentId) => {
      const user = users.find((u) => u.userId === Number(agentId) && isAgentRow(u, companyId));
      return user ? presentAgent(user, companyId) : null;
    },
    createAgent: async (companyId, agent) => {
      if (findUser(agent.email)) {
        throw Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
      }
      const user = {
        userId: nextUserId++,
        companyId: Number(companyId),
        firstName: agent.firstName,
        lastName: agent.lastName,
        email: agent.email,
        passwordHash: null,
        onlineStatus: "Offline",
        accountStatus: "Active",
        roleName: "Support Agent",
      };
      users.push(user);
      return presentAgent(user, companyId);
    },
    setAgentStatus: async (companyId, agentId, status) => {
      const user = users.find((u) => u.userId === Number(agentId) && isAgentRow(u, companyId));
      if (!user) return 0;
      user.accountStatus = status;
      return 1;
    },
    unassignOpenTickets: async (companyId, agentId) => {
      let count = 0;
      for (const ticket of tickets) {
        if (
          ticket.companyId === Number(companyId) &&
          ticket.assignedAgentId === Number(agentId) &&
          isOpenTicket(ticket)
        ) {
          ticket.assignedAgentId = null;
          ticket.updatedAt = new Date().toISOString();
          count += 1;
        }
      }
      return count;
    },
  };

  // Mock mailer: prints the link so a developer can finish the invite flow
  const sendAgentInviteEmail = async (to, link) => {
    console.log("[mock] invite link for", to, link);
  };

  let settings = null;
  const adminModel = {
    getPlatformStats: async () => ({
      totalCompanies: companies.length,
      activeCompanies: companies.length,
      suspendedCompanies: 0,
      pendingCompanies: 0,
      activePercentage: 100,
      pendingPercentage: 0,
      suspendedPercentage: 0,
      totalUsers: users.length,
      companyAdmins: 2,
      supportAgents: 2,
      monthlyGrowth: "0.0%",
    }),
    getRegistrationTrends: async () => [],
    getRecentRegistrations: async () => companies.map((c) => ({ ...c, websiteUrl: c.website })),
    getRecentActivities: async () => [],
    getCompaniesDirectory: async () => ({
      companies: companies.map((c) => ({ ...c, websiteUrl: c.website })),
      total: companies.length,
      page: 1,
      limit: 10,
    }),
    getCompanyById: async (id) => companies.find((c) => c.companyId === Number(id)) || null,
    updateCompanyStatus: async (id, status) => {
      const company = companies.find((c) => c.companyId === Number(id));
      if (!company) return null;
      company.status = status;
      return company;
    },
    deleteCompany: async () => false,
    getPlatformSettings: async () => settings,
    savePlatformSettings: async (next) => {
      settings = next;
    },
  };

  const companyPortalModel = {
    findCompanyAdminContext: async (userId) => {
      const user = users.find((u) => u.userId === Number(userId));
      if (!user) return null;
      const company = companies.find((c) => c.companyId === user.companyId);
      if (!company) return null;
      return {
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        onlineStatus: user.onlineStatus,
        userStatus: user.accountStatus,
        roleName: user.roleName,
        companyId: company.companyId,
        companyName: company.companyName,
        industry: company.industry,
        businessEmail: company.businessEmail,
        phone: company.phone,
        website: company.website,
        description: company.description,
        companyStatus: company.status,
        registrationDate: company.registrationDate,
      };
    },
    getCompanyOverviewCounts: async (companyId) => ({
      supportAgents: users.filter(
        (u) => u.companyId === Number(companyId) && u.roleName === "Support Agent",
      ).length,
      openTickets: tickets.filter(
        (t) =>
          t.companyId === Number(companyId) &&
          (t.status === "Open" || t.status === "In Progress"),
      ).length,
      resolvedToday: tickets.filter(
        (t) =>
          t.companyId === Number(companyId) &&
          isClosed(t.status) &&
          t.resolvedAt &&
          isSameDay(t.resolvedAt),
      ).length,
    }),
  };

  return createApp({
    userModel,
    companyModel,
    tokenModel,
    adminModel,
    companyPortalModel,
    ticketModel,
    agentModel,
    sendAgentInviteEmail,
  });
}

async function listen() {
  const app = await buildMockApp();
  const port = Number(process.env.PORT);
  app.listen(port, "127.0.0.1", () => {
    console.log(`[mock] SupportPilot mock API listening on http://localhost:${port}`);
    console.log(`[mock] Platform Admin: admin@supportpilot.com / ${PLATFORM_ADMIN_PASSWORD}`);
    console.log(`[mock] Company Admin:  owner@acme-demo.com / ${COMPANY_ADMIN_PASSWORD}`);
  });
}

if (require.main === module) {
  listen().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { buildMockApp };
