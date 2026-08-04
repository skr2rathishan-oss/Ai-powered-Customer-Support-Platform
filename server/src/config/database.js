const fs = require("node:fs");
const mongoose = require("mongoose");
const mysql = require("mysql2/promise");

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

async function connectMySQL() {
  const pool = getMySQLPool();
  await pool.query("SELECT 1");
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
  closeDatabaseConnections,
  getMySQLPool,
};
