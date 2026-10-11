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
  await ensurePlatformSettingsTable(pool);
  await ensureTicketsTable(pool);
  await ensureFaqsTable(pool);
  await ensureCompanyAiSettingsTable(pool);
  await ensureCustomerSupport(pool);
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        reset_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token_hash (token_hash),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ensure used_at column exists in case the table was created earlier without it
    const [usedAtCol] = await pool.query(
      "SHOW COLUMNS FROM password_reset_tokens LIKE 'used_at'",
    );
    if (usedAtCol.length === 0) {
      await pool.query(
        "ALTER TABLE password_reset_tokens ADD COLUMN used_at DATETIME NULL AFTER expires_at",
      );
      if (process.env.NODE_ENV !== "test") {
        console.log("Successfully added used_at column to password_reset_tokens");
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Schema initialization notice:", error.message);
    }
  }
}

async function ensurePlatformSettingsTable(pool) {
  try {
    // Single-row table (settings_id is always 1); no seed row, defaults apply until first save
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        settings_id TINYINT PRIMARY KEY,
        settings_json LONGTEXT NOT NULL,
        updated_by INT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Platform settings schema notice:", error.message);
    }
  }
}

async function ensureTicketsTable(pool) {
  try {
    // No foreign keys: tenancy (company_id, assigned_agent_id) is enforced in the
    // application so a column type mismatch can never silently skip table creation
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        ticket_id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        customer_id INT NULL,
        requester_name VARCHAR(150) NULL,
        requester_email VARCHAR(255) NULL,
        subject VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Open',
        priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
        assigned_agent_id INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        resolved_at DATETIME NULL,
        INDEX idx_tickets_company_status (company_id, status, created_at),
        INDEX idx_tickets_company_priority (company_id, priority),
        INDEX idx_tickets_company_agent (company_id, assigned_agent_id),
        INDEX idx_tickets_company_resolved (company_id, resolved_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Tickets schema notice:", error.message);
    }
  }
}

async function ensureFaqsTable(pool) {
  try {
    // No foreign key on company_id, same reasoning as tickets: tenancy is
    // enforced in every WHERE and a type mismatch must not skip table creation
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        faq_id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        question VARCHAR(300) NOT NULL,
        answer TEXT NOT NULL,
        category VARCHAR(60) NULL,
        is_published TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_faqs_company_order (company_id, sort_order, faq_id),
        INDEX idx_faqs_company_published (company_id, is_published),
        INDEX idx_faqs_company_category (company_id, category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("FAQs schema notice:", error.message);
    }
  }
}

async function ensureCompanyAiSettingsTable(pool) {
  try {
    // No foreign key on company_id, same reasoning as tickets/faqs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS company_ai_settings (
        settings_id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        assistant_name VARCHAR(40) NOT NULL DEFAULT 'SupportPilot Assistant',
        tone VARCHAR(20) NOT NULL DEFAULT 'professional',
        greeting VARCHAR(300) NOT NULL DEFAULT '',
        answer_from_faqs_only TINYINT(1) NOT NULL DEFAULT 1,
        confidence_threshold TINYINT UNSIGNED NOT NULL DEFAULT 70,
        escalate_after_failures TINYINT UNSIGNED NOT NULL DEFAULT 2,
        fallback_message VARCHAR(300) NOT NULL DEFAULT '',
        custom_instructions TEXT NULL,
        updated_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_company_ai_settings_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("AI settings schema notice:", error.message);
    }
  }
}

async function ensureCustomerSupport(pool) {
  // The roles table shape beyond role_name is unknown, so this is best effort.
  // Deployments may need to create the Customer role row manually.
  try {
    await pool.query(
      `INSERT INTO roles (role_name)
       SELECT 'Customer' FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name = 'Customer')`,
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "Customer role could not be created automatically; add a 'Customer' row to roles manually:",
        error.message,
      );
    }
  }

  try {
    const [indexes] = await pool.query(
      "SHOW INDEX FROM tickets WHERE Key_name = 'idx_tickets_customer'",
    );
    if (indexes.length === 0) {
      await pool.query(
        "ALTER TABLE tickets ADD INDEX idx_tickets_customer (company_id, customer_id, created_at)",
      );
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Customer tickets index notice:", error.message);
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
