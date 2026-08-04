require("dotenv").config({ quiet: true });

const { createApp } = require("./src/app");
const {
  connectMongoDB,
  connectMySQL,
  closeDatabaseConnections,
} = require("./src/config/database");

const app = createApp();
const port = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    await Promise.all([connectMongoDB(), connectMySQL()]);

    const server = app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log("MongoDB and MySQL are connected");
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
