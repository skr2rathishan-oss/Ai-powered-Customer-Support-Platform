// Exports the live database schema (tables, columns, keys, indexes, row counts)
// from the configured MySQL/TiDB database to docs/database/live-schema.json.
// Usage: npm run db:schema
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const fs = require("node:fs");
const path = require("node:path");
const { getMySQLPool } = require("../src/config/database");

async function exportSchema() {
  const pool = getMySQLPool();
  const db = process.env.MYSQL_DATABASE;
  const [[{ version }]] = await pool.query("SELECT VERSION() AS version");
  const [tables] = await pool.query(
    "SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
    [db]
  );
  const [columns] = await pool.query(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable,
            COLUMN_KEY AS keyType, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [db]
  );
  const [foreignKeys] = await pool.query(
    `SELECT k.TABLE_NAME AS tableName, k.COLUMN_NAME AS columnName, k.REFERENCED_TABLE_NAME AS refTable,
            k.REFERENCED_COLUMN_NAME AS refColumn, k.CONSTRAINT_NAME AS constraintName,
            r.DELETE_RULE AS onDelete, r.UPDATE_RULE AS onUpdate
       FROM information_schema.KEY_COLUMN_USAGE k
       LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
      WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY k.TABLE_NAME, k.COLUMN_NAME`,
    [db]
  );
  const [indexes] = await pool.query(
    `SELECT TABLE_NAME AS tableName, INDEX_NAME AS name, NON_UNIQUE AS nonUnique,
            GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ?
      GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE ORDER BY TABLE_NAME, INDEX_NAME`,
    [db]
  );
  const rowCounts = {};
  for (const { name } of tables) {
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM \`${name}\``);
    rowCounts[name] = Number(n);
  }

  const output = {
    exportedAt: new Date().toISOString(),
    database: db,
    serverVersion: version,
    tables: tables.map((t) => t.name),
    rowCounts,
    columns,
    foreignKeys,
    indexes,
  };
  const outFile = path.join(__dirname, "..", "..", "docs", "database", "live-schema.json");
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log(`Schema of ${tables.length} tables written to ${outFile}`);
  await pool.end();
}

exportSchema().catch((error) => {
  console.error("Schema export failed:", error.message);
  process.exit(1);
});
