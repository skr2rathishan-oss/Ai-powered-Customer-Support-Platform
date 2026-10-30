const fs = require("node:fs");
const path = require("node:path");
const dns = require("node:dns");
const mongoose = require("mongoose");
const mysql = require("mysql2/promise");
const {
  canRetryStatement,
  isTransientDbError,
  withDbRetry,
} = require("../utils/dbErrors");

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
    // Relative CA paths resolve from the server/ directory so .env stays portable
    const caPath = process.env.MYSQL_CA_PATH
      ? path.resolve(__dirname, "../..", process.env.MYSQL_CA_PATH)
      : undefined;

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
      // Keep sockets alive and close idle ones ourselves before the TiDB
      // gateway silently drops them, so requests don't pick up dead connections
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      maxIdle: 3,
      idleTimeout: 60000,
    });
    addTransientRetry(mysqlPool);
  }

  return mysqlPool;
}

function logRetry(error, attempt) {
  if (process.env.NODE_ENV !== "test") {
    console.warn(`[MySQL] ${error.code || error.message}; retrying (attempt ${attempt + 1})`);
  }
}

// Retries a statement once when the database connection fails transiently.
// Transactions take a connection with getConnection(); only acquiring that
// connection is retried, never the statements inside the transaction.
function addTransientRetry(pool) {
  const query = pool.query.bind(pool);
  const execute = pool.execute.bind(pool);
  const getConnection = pool.getConnection.bind(pool);

  pool.query = (sql, values) =>
    withDbRetry(() => query(sql, values), {
      shouldRetry: (error) => canRetryStatement(error, sql),
      onRetry: logRetry,
    });
  pool.execute = (sql, values) =>
    withDbRetry(() => execute(sql, values), {
      shouldRetry: (error) => canRetryStatement(error, sql),
      onRetry: logRetry,
    });
  pool.getConnection = () =>
    withDbRetry(getConnection, { shouldRetry: isTransientDbError, onRetry: logRetry });
}

async function initMySQLSchema() {
  const pool = getMySQLPool();
  await upgradeLegacyTables(pool);
  await ensurePlatformSettingsTable(pool);
  await ensureTicketsTable(pool);
  await ensureTicketRepliesTable(pool);
  await ensureFaqsTable(pool);
  await ensureCompanyAiSettingsTable(pool);
  await ensureCustomerSupport(pool);
  await ensureChatTables(pool);
  await ensureOrderTables(pool);
  await ensureForeignKeys(pool);
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

async function getColumn(pool, table, column) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  return rows[0] || null;
}

async function tableExists(pool, table) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [table]);
  return rows.length > 0;
}

// Adds the column and reports whether it was new, so one-off backfills run once
async function addColumnIfMissing(pool, table, column, definition) {
  if (await getColumn(pool, table, column)) return false;
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  return true;
}

async function makeColumnNullable(pool, table, column) {
  const existing = await getColumn(pool, table, column);
  if (existing && existing.Null === "NO") {
    await pool.query(`ALTER TABLE \`${table}\` MODIFY \`${column}\` ${existing.Type} NULL`);
  }
}

/**
 * Databases created before the ticket, FAQ and settings features already have
 * tables with these names but an older shape, which CREATE TABLE IF NOT EXISTS
 * leaves untouched. Bring them up to the columns the models use. Every step is
 * additive (or relaxes NOT NULL) and only runs when it is still needed.
 */
async function upgradeLegacyTables(pool) {
  try {
    // Invited agents have no password until they accept the invitation
    await makeColumnNullable(pool, "users", "password_hash");

    if (await tableExists(pool, "tickets")) {
      await makeColumnNullable(pool, "tickets", "customer_id");
      // Customers are users with the Customer role, so a key pointing
      // tickets.customer_id at the old customers table rejects every new ticket
      const [legacyKeys] = await pool.query(
        `SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets'
            AND COLUMN_NAME = 'customer_id' AND REFERENCED_TABLE_NAME = 'customers'`,
      );
      for (const { name } of legacyKeys) {
        await pool.query(`ALTER TABLE tickets DROP FOREIGN KEY \`${name}\``);
      }
      await addColumnIfMissing(pool, "tickets", "requester_name", "VARCHAR(150) NULL AFTER customer_id");
      await addColumnIfMissing(pool, "tickets", "requester_email", "VARCHAR(255) NULL AFTER requester_name");
      const addedAssignee = await addColumnIfMissing(
        pool,
        "tickets",
        "assigned_agent_id",
        "INT NULL AFTER priority",
      );
      if (addedAssignee && (await tableExists(pool, "ticket_assignments"))) {
        await pool.query(
          `UPDATE tickets AS t
             JOIN ticket_assignments AS ta
               ON ta.ticket_id = t.ticket_id AND ta.assignment_status = 'Active'
              SET t.assigned_agent_id = ta.agent_id`,
        );
      }
      // The app works with Open / In Progress / Resolved / Closed only
      await pool.query("UPDATE tickets SET status = 'Open' WHERE status = 'Assigned'");
      await pool.query("UPDATE tickets SET status = 'In Progress' WHERE status = 'Pending'");
    }

    if (await tableExists(pool, "faqs")) {
      await makeColumnNullable(pool, "faqs", "created_by_user_id");
      const addedPublished = await addColumnIfMissing(
        pool,
        "faqs",
        "is_published",
        "TINYINT(1) NOT NULL DEFAULT 0",
      );
      await addColumnIfMissing(pool, "faqs", "sort_order", "INT NOT NULL DEFAULT 0");
      const addedCreatedBy = await addColumnIfMissing(pool, "faqs", "created_by", "INT NULL");
      if (addedPublished && (await getColumn(pool, "faqs", "faq_status"))) {
        await pool.query("UPDATE faqs SET is_published = (faq_status = 'Published')");
      }
      if (addedCreatedBy && (await getColumn(pool, "faqs", "created_by_user_id"))) {
        await pool.query("UPDATE faqs SET created_by = created_by_user_id");
      }
    }

    // An older platform_settings table (one column per setting) is kept as a
    // backup so the JSON-document table can take its name
    if (
      (await tableExists(pool, "platform_settings")) &&
      !(await getColumn(pool, "platform_settings", "settings_json")) &&
      !(await tableExists(pool, "platform_settings_legacy"))
    ) {
      await pool.query("RENAME TABLE platform_settings TO platform_settings_legacy");
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Legacy schema upgrade notice:", error.message);
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

async function ensureTicketRepliesTable(pool) {
  try {
    // No foreign keys, same reasoning as tickets. author_role/author_name are
    // snapshots so history survives role or account changes.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_replies (
        reply_id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        ticket_id INT NOT NULL,
        author_id INT NULL,
        author_role VARCHAR(20) NOT NULL,
        author_name VARCHAR(150) NULL,
        is_internal TINYINT(1) NOT NULL DEFAULT 0,
        body TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ticket_replies_ticket (company_id, ticket_id, created_at, reply_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Ticket replies schema notice:", error.message);
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

async function ensureChatTables(pool) {
  try {
    // A customer's conversation with the AI assistant. It ends Resolved when
    // the assistant helped, or Escalated with the ticket a human agent handles.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        session_id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        customer_id INT NOT NULL,
        status ENUM('Active', 'Resolved', 'Escalated') NOT NULL DEFAULT 'Active',
        failed_answers TINYINT UNSIGNED NOT NULL DEFAULT 0,
        ticket_id INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chat_sessions_customer (company_id, customer_id, status),
        INDEX idx_chat_sessions_company_status (company_id, status),
        CONSTRAINT fk_chat_sessions_company FOREIGN KEY (company_id)
          REFERENCES companies (company_id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_sessions_customer FOREIGN KEY (customer_id)
          REFERENCES users (user_id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_sessions_ticket FOREIGN KEY (ticket_id)
          REFERENCES tickets (ticket_id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        message_id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        sender ENUM('customer', 'assistant', 'system') NOT NULL,
        body TEXT NOT NULL,
        confidence TINYINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chat_messages_session (session_id, message_id),
        CONSTRAINT fk_chat_messages_session FOREIGN KEY (session_id)
          REFERENCES chat_sessions (session_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Chat schema notice:", error.message);
    }
  }
}

async function ensureOrderTables(pool) {
  try {
    // A customer's purchase from the company's store. The AI assistant reads
    // these to answer order status, delivery and tracking questions.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        customer_id INT NOT NULL,
        order_number VARCHAR(30) NOT NULL,
        status ENUM('Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned') NOT NULL DEFAULT 'Processing',
        shipping_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        currency CHAR(3) NOT NULL DEFAULT 'LKR',
        shipping_address VARCHAR(255) NULL,
        carrier VARCHAR(60) NULL,
        tracking_number VARCHAR(60) NULL,
        ordered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        estimated_delivery DATE NULL,
        delivered_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_orders_company_number (company_id, order_number),
        INDEX idx_orders_customer (company_id, customer_id, ordered_at),
        CONSTRAINT fk_orders_company FOREIGN KEY (company_id)
          REFERENCES companies (company_id) ON DELETE CASCADE,
        CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
          REFERENCES users (user_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_name VARCHAR(150) NOT NULL,
        size VARCHAR(20) NULL,
        color VARCHAR(40) NULL,
        quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
        unit_price DECIMAL(10, 2) NOT NULL,
        INDEX idx_order_items_order (order_id),
        CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
          REFERENCES orders (order_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Order schema notice:", error.message);
    }
  }
}

/**
 * Relationships that older databases only enforced in application code.
 * Each key is added once, and only when no existing row would break it, so
 * startup never fails on legacy data; the skipped key is reported instead.
 */
const FOREIGN_KEYS = [
  {
    name: "fk_tickets_customer_user",
    table: "tickets",
    column: "customer_id",
    refTable: "users",
    refColumn: "user_id",
    onDelete: "SET NULL",
  },
  {
    name: "fk_tickets_assigned_agent",
    table: "tickets",
    column: "assigned_agent_id",
    refTable: "users",
    refColumn: "user_id",
    onDelete: "SET NULL",
  },
  {
    name: "fk_ticket_replies_ticket",
    table: "ticket_replies",
    column: "ticket_id",
    refTable: "tickets",
    refColumn: "ticket_id",
    onDelete: "CASCADE",
  },
  {
    name: "fk_ticket_replies_author",
    table: "ticket_replies",
    column: "author_id",
    refTable: "users",
    refColumn: "user_id",
    onDelete: "SET NULL",
  },
  {
    name: "fk_ai_settings_company",
    table: "company_ai_settings",
    column: "company_id",
    refTable: "companies",
    refColumn: "company_id",
    onDelete: "CASCADE",
  },
];

async function ensureForeignKeys(pool) {
  for (const key of FOREIGN_KEYS) {
    try {
      const [existing] = await pool.query(
        `SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
            AND REFERENCED_TABLE_NAME = ?`,
        [key.table, key.column, key.refTable],
      );
      if (existing.length > 0) continue;

      const [[{ orphans }]] = await pool.query(
        `SELECT COUNT(*) AS orphans FROM \`${key.table}\` AS c
           LEFT JOIN \`${key.refTable}\` AS p ON p.\`${key.refColumn}\` = c.\`${key.column}\`
          WHERE c.\`${key.column}\` IS NOT NULL AND p.\`${key.refColumn}\` IS NULL`,
      );
      if (Number(orphans) > 0) {
        if (process.env.NODE_ENV !== "test") {
          console.warn(
            `Foreign key ${key.name} skipped: ${orphans} ${key.table} row(s) point at missing ${key.refTable}`,
          );
        }
        continue;
      }

      await pool.query(
        `ALTER TABLE \`${key.table}\` ADD CONSTRAINT \`${key.name}\`
           FOREIGN KEY (\`${key.column}\`) REFERENCES \`${key.refTable}\` (\`${key.refColumn}\`)
           ON DELETE ${key.onDelete} ON UPDATE CASCADE`,
      );
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        console.warn(`Foreign key ${key.name} notice:`, error.message);
      }
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
