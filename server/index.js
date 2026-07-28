require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const {
  connectMongoDB,
  connectMySQL,
  closeDatabaseConnections,
} = require("./src/config/database");

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

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

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
