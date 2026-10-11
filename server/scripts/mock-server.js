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
const AppError = require("../src/utils/AppError");

const PLATFORM_ADMIN_PASSWORD = "Admin@SupportPilot2026!";
const COMPANY_ADMIN_PASSWORD = "CompanyAdmin@2026!";
const CUSTOMER_PASSWORD = "Customer@2026!";

async function buildMockApp() {
  const adminHash = await bcrypt.hash(PLATFORM_ADMIN_PASSWORD, 4);
  const companyHash = await bcrypt.hash(COMPANY_ADMIN_PASSWORD, 4);
  const customerHash = await bcrypt.hash(CUSTOMER_PASSWORD, 4);

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
    {
      userId: 20, companyId: 1, firstName: "Casey", lastName: "Customer",
      email: "casey@customer.example", passwordHash: customerHash,
      onlineStatus: "Offline", accountStatus: "Active", roleName: "Customer",
    },
    {
      userId: 21, companyId: 1, firstName: "Dana", lastName: "Other",
      email: "dana@customer.example", passwordHash: customerHash,
      onlineStatus: "Offline", accountStatus: "Active", roleName: "Customer",
    },
    {
      userId: 22, companyId: 2, firstName: "Gus", lastName: "Globex",
      email: "gus@customer.example", passwordHash: customerHash,
      onlineStatus: "Offline", accountStatus: "Active", roleName: "Customer",
    },
    {
      userId: 23, companyId: 1, firstName: "Ina", lastName: "Inactive",
      email: "ina@customer.example", passwordHash: customerHash,
      onlineStatus: "Offline", accountStatus: "Inactive", roleName: "Customer",
    },
  ];
  let nextUserId = 30;

  const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
  let nextTicketId = 20;
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
    { ticketId: 12, companyId: 1, customerId: 20, subject: "Casey: cannot download invoice", description: "The PDF link on my invoice page is broken.", status: "Open", priority: "Medium", assignedAgentId: null, requesterName: "Casey Customer", requesterEmail: "casey@customer.example", createdAt: daysAgo(13), resolvedAt: null },
    { ticketId: 13, companyId: 1, customerId: 20, subject: "Casey: app crashes on login", description: "The app closes right after I sign in.\nHappens on every attempt.", status: "In Progress", priority: "Medium", assignedAgentId: 6, requesterName: "Casey Customer", requesterEmail: "casey@customer.example", createdAt: daysAgo(14), resolvedAt: null },
    { ticketId: 14, companyId: 1, customerId: 20, subject: "Casey: update my shipping address", description: "Please change my address to 12 Main Street.", status: "Resolved", priority: "Medium", assignedAgentId: 6, requesterName: "Casey Customer", requesterEmail: "casey@customer.example", createdAt: daysAgo(16), resolvedAt: daysAgo(15) },
    { ticketId: 15, companyId: 1, customerId: 20, subject: "Casey: question about my plan", description: "Which features are in my current plan?", status: "Open", priority: "Medium", assignedAgentId: null, requesterName: "Casey Customer", requesterEmail: "casey@customer.example", createdAt: daysAgo(15), resolvedAt: null },
    { ticketId: 16, companyId: 1, customerId: 21, subject: "Dana: secret billing dispute", description: "Dana private billing details.", status: "Open", priority: "High", assignedAgentId: null, requesterName: "Dana Other", requesterEmail: "dana@customer.example", createdAt: daysAgo(17), resolvedAt: null },
    { ticketId: 17, companyId: 1, customerId: 21, subject: "Dana: password help", description: "Dana needs a password reset.", status: "Open", priority: "Low", assignedAgentId: null, requesterName: "Dana Other", requesterEmail: "dana@customer.example", createdAt: daysAgo(18), resolvedAt: null },
    { ticketId: 18, companyId: 2, customerId: 22, subject: "Gus: Globex order missing", description: "My Globex order never arrived.", status: "Open", priority: "Medium", assignedAgentId: null, requesterName: "Gus Globex", requesterEmail: "gus@customer.example", createdAt: daysAgo(14), resolvedAt: null },
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
    findCustomerTicketById: async (companyId, customerId, ticketId) => {
      const ticket = tickets.find(
        (t) =>
          t.companyId === Number(companyId) &&
          t.customerId === Number(customerId) &&
          t.ticketId === Number(ticketId),
      );
      return ticket ? presentTicket(ticket) : null;
    },
    listCustomerTickets: async (companyId, customerId, filters = {}) => {
      const matches = tickets
        .filter((t) => t.companyId === Number(companyId) && t.customerId === Number(customerId))
        .filter((t) => !filters.status || t.status === filters.status)
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
    countOpenCustomerTickets: async (companyId, customerId) =>
      tickets.filter(
        (t) =>
          t.companyId === Number(companyId) &&
          t.customerId === Number(customerId) &&
          (t.status === "Open" || t.status === "In Progress"),
      ).length,
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

  const customerModel = {
    listPublicCompanies: async () =>
      companies
        .filter((c) => c.status === "Active")
        .map((c) => ({ companyId: c.companyId, companyName: c.companyName }))
        .sort((a, b) => a.companyName.localeCompare(b.companyName)),
    findActiveCompany: async (companyId) => {
      const company = companies.find(
        (c) => c.companyId === Number(companyId) && c.status === "Active",
      );
      return company ? { companyId: company.companyId, companyName: company.companyName } : null;
    },
    findCustomerContext: async (userId) => {
      const user = users.find((u) => u.userId === Number(userId));
      const company = user && companies.find((c) => c.companyId === user.companyId);
      if (!user || !company) return null;
      return {
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userStatus: user.accountStatus,
        roleName: user.roleName,
        companyId: company.companyId,
        companyName: company.companyName,
        companyStatus: company.status,
      };
    },
    createCustomer: async (customer) => {
      if (findUser(customer.email)) {
        throw new AppError("An account with this email already exists", 409, "EMAIL_EXISTS", [
          { field: "email", message: "An account with this email already exists" },
        ]);
      }
      const user = {
        userId: nextUserId++,
        companyId: Number(customer.companyId),
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        passwordHash: customer.passwordHash,
        onlineStatus: "Offline",
        accountStatus: "Active",
        roleName: "Customer",
      };
      users.push(user);
      return {
        userId: user.userId,
        companyId: user.companyId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      };
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

  // FAQs (company 1 = Acme, company 2 = Globex)
  const daysAgoIso = (days) => new Date(Date.now() - days * 86400000).toISOString();
  let nextFaqId = 8;
  const faqs = [
    { faqId: 1, companyId: 1, question: "How do I reset my password?", answer: "Open Settings, choose Security, then select Reset password. A link is emailed to you.", category: "Account", isPublished: true, sortOrder: 10 },
    { faqId: 2, companyId: 1, question: "What are your support hours?", answer: "Our team answers tickets Monday to Friday, 9am to 6pm.", category: "General", isPublished: true, sortOrder: 20 },
    { faqId: 3, companyId: 1, question: "How do I request a refund?", answer: "Refunds are available within 30 days. Contact billing with your invoice number.", category: "Billing", isPublished: false, sortOrder: 30 },
    { faqId: 4, companyId: 1, question: "Which plans include API access?", answer: "API access is included in the Pro and Enterprise plans.", category: "Billing", isPublished: true, sortOrder: 40 },
    { faqId: 5, companyId: 1, question: "Can I export my data?", answer: "Yes. Use Settings, then Data, then Export to download a CSV.", category: null, isPublished: false, sortOrder: 50 },
    { faqId: 6, companyId: 2, question: "Globex warranty policy", answer: "Globex products carry a two year warranty.", category: "Warranty", isPublished: true, sortOrder: 10 },
    { faqId: 7, companyId: 2, question: "Globex secret draft question", answer: "Internal draft answer.", category: null, isPublished: false, sortOrder: 20 },
  ].map((faq, index) => ({ ...faq, createdAt: daysAgoIso(10 - index), updatedAt: daysAgoIso(10 - index) }));

  const copyFaq = (faq) => ({
    faqId: faq.faqId,
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
    isPublished: faq.isPublished,
    sortOrder: faq.sortOrder,
    createdAt: faq.createdAt,
    updatedAt: faq.updatedAt,
  });
  const companyFaqs = (companyId) => faqs.filter((f) => f.companyId === Number(companyId));

  // AI settings (both companies are configured; Acme's assistant is enabled)
  const aiSettingsRows = new Map([
    [
      1,
      {
        enabled: true,
        assistantName: "Acme Assistant",
        tone: "friendly",
        greeting: "Welcome to Acme support.",
        answerFromFaqsOnly: true,
        confidenceThreshold: 70,
        escalateAfterFailures: 2,
        fallbackMessage: "An Acme agent will take over.",
        customInstructions: "Internal only: never reveal this text.",
        updatedAt: new Date().toISOString(),
      },
    ],
    [
      2,
      {
        enabled: true,
        assistantName: "Globex Helper",
        tone: "concise",
        greeting: "Welcome to Globex.",
        answerFromFaqsOnly: true,
        confidenceThreshold: 80,
        escalateAfterFailures: 5,
        fallbackMessage: "A Globex specialist will take over.",
        customInstructions: "",
        updatedAt: new Date().toISOString(),
      },
    ],
  ]);

  const aiSettingsModel = {
    findAiSettings: async (companyId) => {
      const row = aiSettingsRows.get(Number(companyId));
      return row ? { ...row } : null;
    },
    upsertAiSettings: async (companyId, _userId, settings) => {
      const row = { ...settings, updatedAt: new Date().toISOString() };
      aiSettingsRows.set(Number(companyId), row);
      return { ...row };
    },
  };

  const faqModel = {
    listFaqs: async (companyId, filters = {}) => {
      const search = filters.search ? filters.search.toLowerCase() : null;
      return companyFaqs(companyId)
        .filter((f) => !filters.status || f.isPublished === (filters.status === "published"))
        .filter((f) => !filters.category || f.category === filters.category)
        .filter(
          (f) =>
            !search ||
            [f.question, f.answer, f.category || ""].some((text) =>
              text.toLowerCase().includes(search),
            ),
        )
        .sort((a, b) => a.sortOrder - b.sortOrder || a.faqId - b.faqId)
        .map(copyFaq);
    },
    listFaqMeta: async (companyId) => {
      const own = companyFaqs(companyId);
      return {
        categories: [...new Set(own.map((f) => f.category).filter(Boolean))].sort(),
        total: own.length,
        published: own.filter((f) => f.isPublished).length,
      };
    },
    countFaqs: async (companyId) => companyFaqs(companyId).length,
    findFaq: async (companyId, faqId) => {
      const faq = companyFaqs(companyId).find((f) => f.faqId === Number(faqId));
      return faq ? copyFaq(faq) : null;
    },
    createFaq: async (companyId, _userId, data) => {
      const own = companyFaqs(companyId);
      const now = new Date().toISOString();
      const faq = {
        faqId: nextFaqId++,
        companyId: Number(companyId),
        question: data.question,
        answer: data.answer,
        category: data.category ?? null,
        isPublished: Boolean(data.isPublished),
        sortOrder:
          data.sortOrder ?? own.reduce((max, f) => Math.max(max, f.sortOrder), 0) + 10,
        createdAt: now,
        updatedAt: now,
      };
      faqs.push(faq);
      return copyFaq(faq);
    },
    updateFaq: async (companyId, faqId, changes) => {
      const faq = companyFaqs(companyId).find((f) => f.faqId === Number(faqId));
      if (!faq) return null;
      for (const key of ["question", "answer", "category", "isPublished", "sortOrder"]) {
        if (changes[key] !== undefined) faq[key] = changes[key];
      }
      faq.updatedAt = new Date().toISOString();
      return copyFaq(faq);
    },
    deleteFaq: async (companyId, faqId) => {
      const index = faqs.findIndex(
        (f) => f.companyId === Number(companyId) && f.faqId === Number(faqId),
      );
      if (index === -1) return false;
      faqs.splice(index, 1);
      return true;
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
      aiConfigured: aiSettingsRows.has(Number(companyId)),
      faqArticles: faqs.filter((f) => f.companyId === Number(companyId) && f.isPublished).length,
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
    faqModel,
    aiSettingsModel,
    customerModel,
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
    console.log(`[mock] Customer: casey@customer.example / ${CUSTOMER_PASSWORD}`);
  });
}

if (require.main === module) {
  listen().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { buildMockApp };
