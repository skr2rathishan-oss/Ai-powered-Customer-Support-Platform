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
      connectMySQL(),
    ]);

    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server is running on port ${port}`);
      console.log(mongoResult ? "MongoDB and MySQL are connected" : "MySQL is connected");

      if (process.env.MAIL_USER || process.env.SMTP_USER) {
        verifySMTPConnection().catch((err) => {
          console.warn("[EMAIL] Initial SMTP verification check failed:", err.message);
        });
      }
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
