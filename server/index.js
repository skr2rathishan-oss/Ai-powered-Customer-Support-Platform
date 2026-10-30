require("dotenv").config({ quiet: true });

const { createApp } = require("./src/app");
const {
  connectMongoDB,
  connectMySQL,
  closeDatabaseConnections,
} = require("./src/config/database");
const { verifySMTPConnection } = require("./src/services/emailService");

const app = createApp();
const port = Number(process.env.PORT || 5000);
const MYSQL_START_ATTEMPTS = 5;

// A stray rejected promise must not take the whole API down: log it and keep serving
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled promise rejection:", reason);
});

// TiDB Cloud's free tier can take a few seconds to wake up, so a failed first
// connection is retried with a growing delay before the server gives up
async function connectMySQLWithRetry() {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await connectMySQL();
    } catch (error) {
      if (attempt >= MYSQL_START_ATTEMPTS) throw error;
      const waitSeconds = attempt * 3;
      console.warn(
        `MySQL connection failed (${error.code || error.message}); retrying in ${waitSeconds}s (attempt ${attempt + 1} of ${MYSQL_START_ATTEMPTS})`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    }
  }
}

async function startServer() {
  try {
    // MySQL holds all application data and is required; MongoDB only feeds
    // health diagnostics, so the server still starts without it
    const [mongoResult] = await Promise.all([
      connectMongoDB().then(
        () => true,
        (error) => {
          console.warn("MongoDB unavailable, continuing without it:", error.message);
          return false;
        },
      ),
      connectMySQLWithRetry(),
    ]);

    // Express 5 also calls this callback when listening fails; the "error"
    // handler below reports that case
    const server = app.listen(port, "0.0.0.0", (listenError) => {
      if (listenError) return;
      console.log(`Server is running on port ${port}`);
      console.log(mongoResult ? "MongoDB and MySQL are connected" : "MySQL is connected");

      if (process.env.MAIL_USER || process.env.SMTP_USER) {
        verifySMTPConnection().catch((err) => {
          console.warn("[EMAIL] Initial SMTP verification check failed:", err.message);
        });
      }
    });

    server.on("error", async (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${port} is already in use. Another copy of the server is probably running: stop it, or set PORT in .env.`,
        );
      } else {
        console.error("Server error:", error.message);
      }
      await closeDatabaseConnections();
      process.exit(1);
    });

    async function shutDown() {
      server.close(async () => {
        await closeDatabaseConnections();
        process.exit(0);
      });
    }

    process.on("SIGINT", shutDown);
    process.on("SIGTERM", shutDown);
  } catch (error) {
    console.error("Failed to start the server:", error.message);
    await closeDatabaseConnections();
    process.exitCode = 1;
  }
}

startServer();
