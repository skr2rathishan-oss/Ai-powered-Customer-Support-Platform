require("dotenv").config({ quiet: true });

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const {
  connectMongoDB,
  connectMySQL,
  closeDatabaseConnections,
} = require("../src/config/database");

const runDatabaseTests = process.env.RUN_DB_TESTS === "true";
const testOptions = {
  skip: runDatabaseTests
    ? false
    : "Set RUN_DB_TESTS=true in .env to run database integration tests",
  timeout: 20000,
  timeout: 30000,
};

test("connects to MongoDB", testOptions, async () => {
  const connection = await connectMongoDB();

  assert.equal(connection.readyState, 1);

  await mongoose.disconnect();
});

test("connects to MySQL", testOptions, async () => {
  try {
    const pool = await connectMySQL();
    const [rows] = await pool.query("SELECT 1 AS connected");

    assert.equal(rows[0].connected, 1);
  } finally {
    await closeDatabaseConnections();
  }
});
