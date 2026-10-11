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
  ];

  const findUser = (email) =>
    users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim()) || null;

  const userModel = {
    findByEmail: async (email) => findUser(email),
    findByGoogleId: async () => null,
    linkGoogleAccount: async () => {},
    setPassword: async () => {},
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

  const tokenModel = {
    createPasswordResetToken: async () => 1,
    findTokenByHash: async () => null,
    findValidToken: async () => null,
    markTokenUsed: async () => {},
    invalidateUserTokens: async () => {},
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
      supportAgents: 1,
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
    }),
  };

  return createApp({
    userModel,
    companyModel,
    tokenModel,
    adminModel,
    companyPortalModel,
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
