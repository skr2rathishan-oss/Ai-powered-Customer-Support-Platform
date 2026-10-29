const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { configurePassport } = require("./config/passport");
const { createAuthRouter } = require("./routes/authRoutes");
const { createAuthService } = require("./services/authService");
const { createAdminRouter } = require("./routes/adminRoutes");
const { createAdminService } = require("./services/adminService");
const { createCompanyRouter } = require("./routes/companyRoutes");
const { createCompanyService } = require("./services/companyService");
const { createTicketRouter } = require("./routes/ticketRoutes");
const { createTicketService } = require("./services/ticketService");
const { createAgentRouter } = require("./routes/agentRoutes");
const { createAgentService } = require("./services/agentService");
const { createFaqRouter } = require("./routes/faqRoutes");
const { createFaqService } = require("./services/faqService");
const { createAiSettingsRouter } = require("./routes/aiSettingsRoutes");
const { createAiSettingsService } = require("./services/aiSettingsService");
const { createCustomerRouter } = require("./routes/customerRoutes");
const { createCustomerService } = require("./services/customerService");
const { createChatRouter } = require("./routes/chatRoutes");
const { createChatService } = require("./services/chatService");
const { createAgentPortalRouter } = require("./routes/agentPortalRoutes");
const { createAgentPortalService } = require("./services/agentPortalService");
const { createPublicRouter } = require("./routes/publicRoutes");
const { resolveRuntimeSettings } = require("./services/runtimeSettings");
const { createMaintenanceMiddleware } = require("./middleware/maintenanceMode");
const defaultCustomerModel = require("./models/customerModel");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

function createApp(dependencies = {}) {
  const app = express();
  const runtimeSettings = resolveRuntimeSettings(dependencies);
  dependencies = { ...dependencies, runtimeSettings };
  app.locals.runtimeSettings = runtimeSettings;
  const authService = dependencies.authService || createAuthService(dependencies);
  const adminService = dependencies.adminService || createAdminService(dependencies);
  const companyService =
    dependencies.companyService || createCompanyService(dependencies);
  const ticketService =
    dependencies.ticketService || createTicketService(dependencies);
  const agentService =
    dependencies.agentService || createAgentService(dependencies);
  const faqService = dependencies.faqService || createFaqService(dependencies);
  const aiSettingsService =
    dependencies.aiSettingsService || createAiSettingsService(dependencies);
  const customerService =
    dependencies.customerService || createCustomerService(dependencies);
  const agentPortalService =
    dependencies.agentPortalService || createAgentPortalService(dependencies);
  const chatService = dependencies.chatService || createChatService(dependencies);
  const passport = dependencies.passport || configurePassport(dependencies);

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  const configuredOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  const allowedOrigins = new Set([
    configuredOrigin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
  ]);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());
  app.use(passport.initialize());

  if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.use(createMaintenanceMiddleware(runtimeSettings));

  const authRouter = createAuthRouter(authService, {
    passport,
    isGoogleConfigured: dependencies.isGoogleConfigured,
  });
  const adminRouter = createAdminRouter(adminService);
  app.use("/api/auth", authRouter);
  app.use("/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/company/tickets", createTicketRouter(ticketService));
  app.use("/api/company/agents", createAgentRouter(agentService));
  app.use("/api/company/faqs", createFaqRouter(faqService));
  app.use(
    "/api/company/ai-settings",
    createAiSettingsRouter(aiSettingsService),
  );
  app.use("/api/company", createCompanyRouter(companyService));
  app.use("/api/agent", createAgentPortalRouter(agentPortalService));
  app.use("/api/customer/chat", createChatRouter(chatService));
  app.use("/api/customer", createCustomerRouter(customerService));
  app.use(
    "/api/public",
    createPublicRouter(
      dependencies.customerModel || defaultCustomerModel,
      runtimeSettings,
    ),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
