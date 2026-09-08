const fs = require("node:fs");
const dns = require("node:dns");
const mongoose = require("mongoose");
const mysql = require("mysql2/promise");

// Configure public DNS servers fallback for MongoDB Atlas SRV resolution
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore if custom DNS is restricted in runtime
}

let mysqlPool;

function requireEnvironmentVariable(name) {
  const value = process.env[name];

  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function connectMongoDB() {
  const uri = requireEnvironmentVariable("MONGODB_URI");

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    serverSelectionTimeoutMS: 15000,
    family: 4,
  });

  return mongoose.connection;
}

function getMySQLPool() {
  if (!mysqlPool) {
    const caPath = process.env.MYSQL_CA_PATH;

    mysqlPool = mysql.createPool({
      host: requireEnvironmentVariable("MYSQL_HOST"),
      port: Number(process.env.MYSQL_PORT || 3306),
      user: requireEnvironmentVariable("MYSQL_USER"),
      password: process.env.MYSQL_PASSWORD || "",
      database: requireEnvironmentVariable("MYSQL_DATABASE"),
      connectTimeout: 10000,
      ...(caPath && {
        ssl: {
          ca: fs.readFileSync(caPath, "utf8"),
          rejectUnauthorized: true,
        },
      }),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  return mysqlPool;
}

async function initMySQLSchema() {
  const pool = getMySQLPool();
  try {
    const [columns] = await pool.query(
      "SHOW COLUMNS FROM users LIKE 'google_id'",
    );
    if (columns.length === 0) {
      await pool.query(
        "ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER email",
      );
      if (process.env.NODE_ENV !== "test") {
        console.log("Successfully ensured google_id column exists in users table");
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Schema initialization notice:", error.message);
    }
  }
}

async function connectMySQL() {
  const pool = getMySQLPool();
  await pool.query("SELECT 1");
  await initMySQLSchema();
  return pool;
}

async function closeDatabaseConnections() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = undefined;
  }
}

module.exports = {
  connectMongoDB,
  connectMySQL,
  initMySQLSchema,
  closeDatabaseConnections,
  getMySQLPool,
};
