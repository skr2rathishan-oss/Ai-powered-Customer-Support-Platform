/**
 * Creates (or repairs) one demo account for every role, plus a small amount of
 * sample data so each dashboard has something to show:
 *
 *   npm run seed:demo
 *
 * Safe to run repeatedly. Demo accounts get their documented password and
 * Active status back on every run. The Platform Admin is only created when
 * missing, so an existing admin password is never overwritten. Sample tickets
 * and FAQs are only added while the demo company has none.
 */
require("dotenv").config({ quiet: true });

const bcrypt = require("bcrypt");
const { getMySQLPool, initMySQLSchema, closeDatabaseConnections } = require("../src/config/database");

const DEMO = {
  platformAdmin: {
    firstName: "Platform",
    lastName: "Admin",
    email: "admin@supportpilot.com",
    password: "Admin@SupportPilot2026!",
  },
  company: {
    name: "Acme Demo Co",
    industry: "SaaS",
    businessEmail: "support@acme.example",
    phone: "+94 11 234 5678",
    website: "https://acme.example",
    description: "Demo tenant used to try every SupportPilot portal.",
  },
  companyAdmin: {
    firstName: "Ada",
    lastName: "Owner",
    email: "owner@acme.example",
    password: "CompanyAdmin@2026!",
  },
  agents: [
    { firstName: "Sam", lastName: "Agent", email: "sam.agent@acme.example", password: "Agent@2026!" },
    { firstName: "Riya", lastName: "Patel", email: "riya.agent@acme.example", password: "Agent@2026!" },
  ],
  customer: {
    firstName: "Casey",
    lastName: "Customer",
    email: "casey@customer.example",
    password: "Customer@2026!",
  },
};

const hash = (password) => bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 12));

async function roleId(db, roleName) {
  const [rows] = await db.execute("SELECT role_id FROM roles WHERE role_name = ? LIMIT 1", [roleName]);
  if (rows.length > 0) return rows[0].role_id;
  const [result] = await db.execute("INSERT INTO roles (role_name) VALUES (?)", [roleName]);
  return result.insertId;
}

// Inserts the user, or resets an existing demo user to the documented state
async function upsertUser(db, { roleName, companyId, person, resetExisting = true }) {
  const role = await roleId(db, roleName);
  const [existing] = await db.execute(
    "SELECT user_id FROM users WHERE LOWER(email) = ? LIMIT 1",
    [person.email.toLowerCase()],
  );

  if (existing.length > 0) {
    const userId = existing[0].user_id;
    if (resetExisting) {
      await db.execute(
        `UPDATE users
            SET role_id = ?, company_id = ?, first_name = ?, last_name = ?,
                password_hash = ?, account_status = 'Active'
          WHERE user_id = ?`,
        [role, companyId, person.firstName, person.lastName, await hash(person.password), userId],
      );
    }
    return { userId, created: false };
  }

  const [result] = await db.execute(
    `INSERT INTO users
       (role_id, company_id, first_name, last_name, email, password_hash, online_status, account_status)
     VALUES (?, ?, ?, ?, ?, ?, 'Offline', 'Active')`,
    [role, companyId, person.firstName, person.lastName, person.email, await hash(person.password)],
  );
  return { userId: result.insertId, created: true };
}

async function upsertCompany(db) {
  const { company } = DEMO;
  const [existing] = await db.execute(
    "SELECT company_id FROM companies WHERE LOWER(business_email) = ? LIMIT 1",
    [company.businessEmail],
  );
  if (existing.length > 0) {
    await db.execute("UPDATE companies SET status = 'Active' WHERE company_id = ?", [existing[0].company_id]);
    return existing[0].company_id;
  }

  const [result] = await db.execute(
    `INSERT INTO companies
       (company_name, industry, business_email, company_phone, website_url, description, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
    [company.name, company.industry, company.businessEmail, company.phone, company.website, company.description],
  );
  return result.insertId;
}

async function seedSampleData(db, { companyId, adminId, agentIds, customerId }) {
  const [[faqCount]] = await db.execute("SELECT COUNT(*) AS n FROM faqs WHERE company_id = ?", [companyId]);
  if (Number(faqCount.n) === 0) {
    const faqs = [
      ["How do I reset my password?", "Use 'Forgot password' on the sign-in page and follow the emailed link.", "Account", 1],
      ["What are your support hours?", "Our team answers tickets Monday to Friday, 8am to 6pm.", "General", 1],
      ["Which plans include API access?", "API access is included in the Business and Enterprise plans.", "Billing", 1],
      ["How do I export my data?", "Draft: export steps are being finalised.", "Account", 0],
    ];
    for (const [index, [question, answer, category, published]] of faqs.entries()) {
      await db.execute(
        `INSERT INTO faqs (company_id, question, answer, category, is_published, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [companyId, question, answer, category, published, index, adminId],
      );
    }
  }

  const [[ticketCount]] = await db.execute("SELECT COUNT(*) AS n FROM tickets WHERE company_id = ?", [companyId]);
  if (Number(ticketCount.n) === 0) {
    const { customer } = DEMO;
    const customerName = `${customer.firstName} ${customer.lastName}`;
    // [subject, description, status, priority, agent index or null, from customer, days ago]
    const tickets = [
      ["Cannot download my invoice", "The download button on the billing page does nothing.", "Open", "High", 0, true, 0],
      ["App crashes on login", "The mobile app closes right after I sign in.", "In Progress", "Urgent", 0, true, 1],
      ["Question about my plan", "Can I switch from monthly to yearly billing?", "Open", "Medium", null, true, 2],
      ["Update my shipping address", "Please change my address for future orders.", "Resolved", "Low", 1, true, 4],
      ["Login page shows error 500", "Several users report a server error on sign-in.", "Open", "Urgent", null, false, 0],
      ["Feature request: dark mode", "Customers are asking for a dark theme.", "In Progress", "Low", 1, false, 3],
    ];
    for (const [subject, description, status, priority, agentIndex, fromCustomer, daysAgo] of tickets) {
      const [result] = await db.execute(
        `INSERT INTO tickets
           (company_id, customer_id, requester_name, requester_email, subject, description,
            status, priority, assigned_agent_id, created_at, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), ?)`,
        [
          companyId,
          fromCustomer ? customerId : null,
          fromCustomer ? customerName : null,
          fromCustomer ? customer.email : null,
          subject,
          description,
          status,
          priority,
          agentIndex === null ? null : agentIds[agentIndex],
          String(daysAgo),
          status === "Resolved" ? new Date() : null,
        ],
      );
      if (agentIndex !== null) {
        const agent = DEMO.agents[agentIndex];
        await db.execute(
          `INSERT INTO ticket_replies (company_id, ticket_id, author_id, author_role, author_name, is_internal, body)
           VALUES (?, ?, ?, 'Agent', ?, 0, ?)`,
          [
            companyId,
            result.insertId,
            agentIds[agentIndex],
            `${agent.firstName} ${agent.lastName}`,
            "Thanks for reaching out. I'm looking into this now.",
          ],
        );
      }
    }
  }

  await db.execute(
    `INSERT INTO company_ai_settings (company_id, enabled, assistant_name, greeting, fallback_message, updated_by)
     VALUES (?, 1, 'Acme Assistant', 'Hi! Ask me anything about your Acme account.',
             'I could not find the answer, so I am handing you to our support team.', ?)
     ON DUPLICATE KEY UPDATE company_id = company_id`,
    [companyId, adminId],
  );
}

async function main() {
  // Make sure every table and column the app needs exists first
  await initMySQLSchema();

  const connection = await getMySQLPool().getConnection();
  try {
    await connection.beginTransaction();

    const admin = await upsertUser(connection, {
      roleName: "Platform Admin",
      companyId: null,
      person: DEMO.platformAdmin,
      resetExisting: false,
    });

    const companyId = await upsertCompany(connection);
    const owner = await upsertUser(connection, {
      roleName: "Company Admin",
      companyId,
      person: DEMO.companyAdmin,
    });
    await connection.execute(
      `INSERT INTO company_admins (admin_id, company_id)
       SELECT ?, ? FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM company_admins WHERE admin_id = ? AND company_id = ?)`,
      [owner.userId, companyId, owner.userId, companyId],
    );

    const agentIds = [];
    for (const agent of DEMO.agents) {
      const { userId } = await upsertUser(connection, { roleName: "Support Agent", companyId, person: agent });
      agentIds.push(userId);
    }

    const customer = await upsertUser(connection, {
      roleName: "Customer",
      companyId,
      person: DEMO.customer,
    });

    await seedSampleData(connection, {
      companyId,
      adminId: owner.userId,
      agentIds,
      customerId: customer.userId,
    });

    await connection.commit();

    console.log("Demo accounts are ready:\n");
    console.table([
      { role: "Platform Admin", email: DEMO.platformAdmin.email, password: admin.created ? DEMO.platformAdmin.password : "(existing, unchanged)", login: "/login" },
      { role: "Company Admin", email: DEMO.companyAdmin.email, password: DEMO.companyAdmin.password, login: "/login/company" },
      ...DEMO.agents.map((a) => ({ role: "Support Agent", email: a.email, password: a.password, login: "/login" })),
      { role: "Customer", email: DEMO.customer.email, password: DEMO.customer.password, login: "/login" },
    ]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => closeDatabaseConnections());
