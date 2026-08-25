const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { configurePassport } = require("./config/passport");
const { createAuthRouter } = require("./routes/authRoutes");
const { createAuthService } = require("./services/authService");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

function createApp(dependencies = {}) {
  const app = express();
  const authService = dependencies.authService || createAuthService(dependencies);
  const passport = dependencies.passport || configurePassport(dependencies);

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
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

  app.use("/api/auth", createAuthRouter(authService, { passport }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
