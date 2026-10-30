/**
 * Creates (or repairs) one demo account for every role, plus a small amount of
 * sample data so each dashboard has something to show:
 *
 *   npm run seed:demo
 *
 * Safe to run repeatedly. Demo accounts get their documented password and
 * Active status back on every run. The Platform Admin is only created when
 * missing, so an existing admin password is never overwritten. Sample tickets
 * are only added while the demo company has none, clothing-store FAQs are
 * added when missing, and sample orders while the demo customer has none.
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
    industry: "Fashion & Apparel",
    businessEmail: "support@acme.example",
    phone: "+94 11 234 5678",
    website: "https://acme.example",
    description: "Online clothing store (demo tenant used to try every SupportPilot portal).",
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

// [question, answer, category]: Acme Demo Co is an online clothing store, so
// these are what its AI assistant answers from
const CLOTHING_FAQS = [
  [
    "How long does delivery take?",
    "Orders within Colombo arrive in 1-2 working days and the rest of Sri Lanka in 3-5 working days. International orders take 7-14 working days.",
    "Shipping",
  ],
  [
    "How much does shipping cost?",
    "Delivery is free on orders over LKR 10,000. Below that, island-wide delivery is LKR 450. International shipping is calculated at checkout.",
    "Shipping",
  ],
  [
    "How can I track my order?",
    "When your order ships we email you the courier name and tracking number. You can also ask our assistant \"Where is my order?\" at any time.",
    "Orders",
  ],
  [
    "Can I change or cancel my order?",
    "You can change the size, colour or address, or cancel the order, until it ships (usually within 12 hours of ordering). Ask our team in chat and they will update it. Shipped orders cannot be cancelled, but you can return them.",
    "Orders",
  ],
  [
    "What is your return policy?",
    "Unworn items with the tags attached can be returned within 30 days of delivery for a full refund. Underwear, swimwear and items marked Final Sale cannot be returned.",
    "Returns",
  ],
  [
    "How do I exchange an item for a different size?",
    "Contact us with your order number and the size you need. We email a free return label and ship the new size as soon as the courier collects the original item.",
    "Returns",
  ],
  [
    "When will I get my refund?",
    "Refunds go back to your original payment method within 5-7 working days after we receive and check the returned item. Cash on delivery orders are refunded by bank transfer.",
    "Returns",
  ],
  [
    "What should I do if my item arrives damaged or wrong?",
    "We're sorry! Send us a photo within 7 days of delivery and we will replace the item or refund you in full, including shipping.",
    "Orders",
  ],
  [
    "How do I find my size?",
    "Every product page has a size chart in centimetres. If you are between sizes, choose the larger size for shirts and jackets and your usual waist size for jeans and chinos.",
    "Sizing",
  ],
  [
    "How should I wash my clothes?",
    "Always follow the care label. In general, wash denim and dark colours inside out in cold water, and dry knitwear flat so it keeps its shape.",
    "Products",
  ],
  [
    "Which payment methods do you accept?",
    "We accept Visa, Mastercard, American Express, bank transfer, and cash on delivery for orders up to LKR 25,000.",
    "Payments",
  ],
];

// Order history for the demo customer. Days are counted back from today, so
// the "in transit" order always looks current
const CUSTOMER_ORDERS = [
  {
    orderNumber: "AC-10533",
    status: "Processing",
    orderedDaysAgo: 0,
    deliveryInDays: 4,
    shippingFee: 450,
    items: [["Floral Wrap Summer Dress", "S", "Blue", 1, 6500]],
  },
  {
    orderNumber: "AC-10517",
    status: "Shipped",
    orderedDaysAgo: 3,
    deliveryInDays: 1,
    shippingFee: 0,
    carrier: "Acme Express",
    trackingNumber: "AX7731942LK",
    items: [
      ["Denim Trucker Jacket", "L", "Indigo", 1, 8900],
      ["Graphic Cotton T-Shirt", "L", "Black", 2, 2450],
    ],
  },
  {
    orderNumber: "AC-10482",
    status: "Delivered",
    orderedDaysAgo: 18,
    deliveredDaysAgo: 15,
    shippingFee: 0,
    carrier: "Acme Express",
    trackingNumber: "AX7690155LK",
    items: [
      ["Classic Oxford Shirt", "M", "White", 2, 3950],
      ["Slim Fit Chinos", "32", "Beige", 1, 4800],
    ],
  },
  {
    orderNumber: "AC-10455",
    status: "Cancelled",
    orderedDaysAgo: 26,
    shippingFee: 450,
    items: [["Canvas Low-Top Sneakers", "42", "White", 1, 7800]],
  },
  {
    orderNumber: "AC-10391",
    status: "Returned",
    orderedDaysAgo: 41,
    deliveredDaysAgo: 37,
    shippingFee: 450,
    carrier: "Acme Express",
    trackingNumber: "AX7512208LK",
    items: [["Wool Blend Crew Sweater", "M", "Grey", 1, 7200]],
  },
];

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
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
    await db.execute(
      "UPDATE companies SET status = 'Active', industry = ?, description = ? WHERE company_id = ?",
      [company.industry, company.description, existing[0].company_id],
    );
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
      ["Do you offer gift wrapping?", "Draft: gift wrapping is coming soon.", "Orders", 0],
    ];
    for (const [index, [question, answer, category, published]] of faqs.entries()) {
      await db.execute(
        `INSERT INTO faqs (company_id, question, answer, category, is_published, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [companyId, question, answer, category, published, index, adminId],
      );
    }
  }

  // Added by question, so FAQs the company admin edited or deleted are not duplicated
  const [[{ maxOrder }]] = await db.execute(
    "SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM faqs WHERE company_id = ?",
    [companyId],
  );
  let sortOrder = Number(maxOrder);
  for (const [question, answer, category] of CLOTHING_FAQS) {
    const [found] = await db.execute(
      "SELECT 1 FROM faqs WHERE company_id = ? AND question = ? LIMIT 1",
      [companyId, question],
    );
    if (found.length > 0) continue;
    sortOrder += 1;
    await db.execute(
      `INSERT INTO faqs (company_id, question, answer, category, is_published, sort_order, created_by)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [companyId, question, answer, category, sortOrder, adminId],
    );
  }

  const [[orderCount]] = await db.execute(
    "SELECT COUNT(*) AS n FROM orders WHERE company_id = ? AND customer_id = ?",
    [companyId, customerId],
  );
  if (Number(orderCount.n) === 0) {
    for (const order of CUSTOMER_ORDERS) {
      const itemsTotal = order.items.reduce((sum, [, , , quantity, price]) => sum + quantity * price, 0);
      const [result] = await db.execute(
        `INSERT INTO orders
           (company_id, customer_id, order_number, status, shipping_fee, total_amount, currency,
            shipping_address, carrier, tracking_number, ordered_at, estimated_delivery, delivered_at)
         VALUES (?, ?, ?, ?, ?, ?, 'LKR', ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          customerId,
          order.orderNumber,
          order.status,
          order.shippingFee,
          itemsTotal + order.shippingFee,
          "42 Galle Road, Colombo 03, Sri Lanka",
          order.carrier ?? null,
          order.trackingNumber ?? null,
          daysFromNow(-order.orderedDaysAgo),
          order.deliveryInDays === undefined ? null : daysFromNow(order.deliveryInDays),
          order.deliveredDaysAgo === undefined ? null : daysFromNow(-order.deliveredDaysAgo),
        ],
      );
      for (const [productName, size, color, quantity, unitPrice] of order.items) {
        await db.execute(
          `INSERT INTO order_items (order_id, product_name, size, color, quantity, unit_price)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [result.insertId, productName, size, color, quantity, unitPrice],
        );
      }
    }
  }

  const [[ticketCount]] = await db.execute("SELECT COUNT(*) AS n FROM tickets WHERE company_id = ?", [companyId]);
  if (Number(ticketCount.n) === 0) {
    const { customer } = DEMO;
    const customerName = `${customer.firstName} ${customer.lastName}`;
    // [subject, description, status, priority, agent index or null, from customer, days ago]
    const tickets = [
      ["Exchange chinos for a bigger size", "Order AC-10482: the Slim Fit Chinos (32) are too tight. Can I get a 34?", "Open", "Medium", 0, true, 0],
      ["Refund for returned sweater", "I returned the Wool Blend Crew Sweater from order AC-10391 but have not seen the refund yet.", "In Progress", "High", 0, true, 1],
      ["Change delivery address", "Please deliver order AC-10533 to my office instead: 15 Union Place, Colombo 02.", "Open", "Medium", null, true, 0],
      ["Card charged twice", "My card was charged twice for order AC-10455, which I cancelled.", "Resolved", "High", 1, true, 20],
      ["Checkout page shows error 500", "Several customers report a server error when paying by card.", "Open", "Urgent", null, false, 0],
      ["Restock request: linen shirts", "Customers keep asking when the white linen shirts are back in stock.", "In Progress", "Low", 1, false, 3],
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
     VALUES (?, 1, 'Acme Assistant', 'Hi! I can help with your orders, delivery, returns and sizing. What do you need?',
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
