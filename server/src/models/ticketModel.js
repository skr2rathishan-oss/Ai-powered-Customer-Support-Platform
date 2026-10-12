const { getMySQLPool } = require("../config/database");

// Every function takes the company id first and scopes every statement with
// `company_id = ?`. The optional trailing `options.pool` exists for tests.
const TICKET_SELECT = `SELECT
       t.ticket_id AS ticketId,
       t.company_id AS companyId,
       t.customer_id AS customerId,
       t.requester_name AS requesterName,
       t.requester_email AS requesterEmail,
       t.subject AS subject,
       t.description AS description,
       t.status AS status,
       t.priority AS priority,
       t.assigned_agent_id AS assignedAgentId,
       NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), '') AS assigneeName,
       t.created_at AS createdAt,
       t.updated_at AS updatedAt,
       t.resolved_at AS resolvedAt
     FROM tickets AS t
     LEFT JOIN users AS a
       ON a.user_id = t.assigned_agent_id AND a.company_id = t.company_id`;

function poolFrom(options) {
  return options?.pool || getMySQLPool();
}

function isClosedStatus(status) {
  return status === "Resolved" || status === "Closed";
}

// Escapes LIKE wildcards so user text is matched literally
function escapeLike(term) {
  return term.replace(/[\\%_]/g, "\\$&");
}

async function findTicketById(companyId, ticketId, options) {
  const [rows] = await poolFrom(options).execute(
    `${TICKET_SELECT}
     WHERE t.company_id = ? AND t.ticket_id = ?
     LIMIT 1`,
    [companyId, ticketId],
  );

  return rows[0] || null;
}

async function createTicket(companyId, ticket, options) {
  const [result] = await poolFrom(options).execute(
    `INSERT INTO tickets
       (company_id, customer_id, requester_name, requester_email, subject,
        description, status, priority, assigned_agent_id, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${
       isClosedStatus(ticket.status) ? "NOW()" : "NULL"
     })`,
    [
      companyId,
      ticket.customerId ?? null,
      ticket.requesterName ?? null,
      ticket.requesterEmail ?? null,
      ticket.subject,
      ticket.description,
      ticket.status,
      ticket.priority,
      ticket.assignedAgentId ?? null,
    ],
  );

  return findTicketById(companyId, result.insertId, options);
}

async function listTickets(companyId, filters = {}, options) {
  const pool = poolFrom(options);
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 20;
  const offset = (page - 1) * limit;

  const conditions = ["t.company_id = ?"];
  const params = [companyId];

  if (filters.status) {
    conditions.push("t.status = ?");
    params.push(filters.status);
  }
  if (filters.priority) {
    conditions.push("t.priority = ?");
    params.push(filters.priority);
  }
  if (filters.unassigned) {
    conditions.push("t.assigned_agent_id IS NULL");
  } else if (filters.assigneeId) {
    conditions.push("t.assigned_agent_id = ?");
    params.push(filters.assigneeId);
  }
  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`;
    conditions.push(
      "(t.subject LIKE ? ESCAPE '\\\\' OR t.requester_name LIKE ? ESCAPE '\\\\' OR t.requester_email LIKE ? ESCAPE '\\\\')",
    );
    params.push(pattern, pattern, pattern);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM tickets AS t ${whereClause}`,
    params,
  );

  // query() rather than execute(): LIMIT/OFFSET placeholders need plain numbers
  const [tickets] = await pool.query(
    `${TICKET_SELECT}
     ${whereClause}
     ORDER BY t.created_at DESC, t.ticket_id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { tickets, total: Number(countRows[0]?.total || 0), page, limit };
}

async function updateTicket(companyId, ticketId, changes = {}, options) {
  const assignments = [];
  const params = [];

  // Column names are fixed here; only values come from the caller
  if (changes.status !== undefined) {
    assignments.push("status = ?");
    params.push(changes.status);
    assignments.push(
      isClosedStatus(changes.status)
        ? "resolved_at = COALESCE(resolved_at, NOW())"
        : "resolved_at = NULL",
    );
  }
  if (changes.priority !== undefined) {
    assignments.push("priority = ?");
    params.push(changes.priority);
  }
  if (changes.assignedAgentId !== undefined) {
    assignments.push("assigned_agent_id = ?");
    params.push(changes.assignedAgentId);
  }

  if (assignments.length > 0) {
    await poolFrom(options).execute(
      `UPDATE tickets SET ${assignments.join(", ")}
       WHERE company_id = ? AND ticket_id = ?${changes.onlyIfStatus ? " AND status = ?" : ""}`,
      [
        ...params,
        companyId,
        ticketId,
        ...(changes.onlyIfStatus ? [changes.onlyIfStatus] : []),
      ],
    );
  }

  return findTicketById(companyId, ticketId, options);
}

const ASSIGNABLE_AGENT_FROM = `FROM users AS u
     INNER JOIN roles AS r ON r.role_id = u.role_id
     WHERE u.company_id = ? AND r.role_name = 'Support Agent'
       AND u.account_status = 'Active'`;

async function findAssignableAgent(companyId, agentId, options) {
  const [rows] = await poolFrom(options).execute(
    `SELECT
       u.user_id AS userId,
       u.first_name AS firstName,
       u.last_name AS lastName,
       u.email AS email
     ${ASSIGNABLE_AGENT_FROM} AND u.user_id = ?
     LIMIT 1`,
    [companyId, agentId],
  );

  return rows[0] || null;
}

async function listAssignableAgents(companyId, options) {
  const [rows] = await poolFrom(options).execute(
    `SELECT
       u.user_id AS userId,
       u.first_name AS firstName,
       u.last_name AS lastName,
       u.email AS email,
       u.online_status AS onlineStatus
     ${ASSIGNABLE_AGENT_FROM}
     ORDER BY u.first_name, u.last_name`,
    [companyId],
  );

  return rows;
}

// Customer-scoped reads: company_id and customer_id are always the first two
// parameters and are part of EVERY WHERE clause.
async function findCustomerTicketById(companyId, customerId, ticketId, options) {
  const [rows] = await poolFrom(options).execute(
    `${TICKET_SELECT}
     WHERE t.company_id = ? AND t.customer_id = ? AND t.ticket_id = ?
     LIMIT 1`,
    [companyId, customerId, ticketId],
  );

  return rows[0] || null;
}

async function listCustomerTickets(companyId, customerId, filters = {}, options) {
  const pool = poolFrom(options);
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 20;
  const offset = (page - 1) * limit;

  const conditions = ["t.company_id = ?", "t.customer_id = ?"];
  const params = [companyId, customerId];

  if (filters.status) {
    conditions.push("t.status = ?");
    params.push(filters.status);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM tickets AS t ${whereClause}`,
    params,
  );

  const [tickets] = await pool.query(
    `${TICKET_SELECT}
     ${whereClause}
     ORDER BY t.created_at DESC, t.ticket_id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { tickets, total: Number(countRows[0]?.total || 0), page, limit };
}

async function countOpenCustomerTickets(companyId, customerId, options) {
  const [rows] = await poolFrom(options).execute(
    `SELECT COUNT(*) AS total FROM tickets AS t
     WHERE t.company_id = ? AND t.customer_id = ?
       AND t.status IN ('Open', 'In Progress')`,
    [companyId, customerId],
  );

  return Number(rows[0]?.total || 0);
}

// Agent-scoped reads/writes: company_id and assigned_agent_id are the first two
// parameters and part of EVERY WHERE clause.
const AGENT_SORT_ORDER = {
  newest: "t.created_at DESC, t.ticket_id DESC",
  oldest: "t.created_at ASC, t.ticket_id ASC",
  priority:
    "FIELD(t.priority, 'Urgent', 'High', 'Medium', 'Low'), t.created_at DESC, t.ticket_id DESC",
};

async function listAgentTickets(companyId, agentId, filters = {}, options) {
  const pool = poolFrom(options);
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 20;
  const offset = (page - 1) * limit;

  const conditions = ["t.company_id = ?", "t.assigned_agent_id = ?"];
  const params = [companyId, agentId];

  if (filters.status) {
    conditions.push("t.status = ?");
    params.push(filters.status);
  }
  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`;
    conditions.push(
      "(t.subject LIKE ? ESCAPE '\\\\' OR t.requester_name LIKE ? ESCAPE '\\\\' OR t.requester_email LIKE ? ESCAPE '\\\\')",
    );
    params.push(pattern, pattern, pattern);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;
  const orderBy = AGENT_SORT_ORDER[filters.sort] || AGENT_SORT_ORDER.newest;

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM tickets AS t ${whereClause}`,
    params,
  );

  const [tickets] = await pool.query(
    `${TICKET_SELECT}
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { tickets, total: Number(countRows[0]?.total || 0), page, limit };
}

async function countAgentTicketsByStatus(companyId, agentId, options) {
  const [rows] = await poolFrom(options).execute(
    `SELECT t.status AS status, COUNT(*) AS total FROM tickets AS t
     WHERE t.company_id = ? AND t.assigned_agent_id = ?
     GROUP BY t.status`,
    [companyId, agentId],
  );

  const counts = { open: 0, inProgress: 0, resolved: 0, closed: 0, total: 0 };
  const keys = {
    Open: "open",
    "In Progress": "inProgress",
    Resolved: "resolved",
    Closed: "closed",
  };
  for (const row of rows) {
    const total = Number(row.total || 0);
    if (keys[row.status]) counts[keys[row.status]] = total;
    counts.total += total;
  }
  return counts;
}

async function findAgentTicketById(companyId, agentId, ticketId, options) {
  const [rows] = await poolFrom(options).execute(
    `${TICKET_SELECT}
     WHERE t.company_id = ? AND t.assigned_agent_id = ? AND t.ticket_id = ?
     LIMIT 1`,
    [companyId, agentId, ticketId],
  );

  return rows[0] || null;
}

// Returns null when nothing matched (not assigned, other company or Closed)
async function updateAgentTicketStatus(companyId, agentId, ticketId, status, options) {
  const [result] = await poolFrom(options).execute(
    `UPDATE tickets SET status = ?, ${
      isClosedStatus(status)
        ? "resolved_at = COALESCE(resolved_at, NOW())"
        : "resolved_at = NULL"
    }
     WHERE company_id = ? AND assigned_agent_id = ? AND ticket_id = ?
       AND status <> 'Closed'`,
    [status, companyId, agentId, ticketId],
  );

  if (!result?.affectedRows) return null;
  return findAgentTicketById(companyId, agentId, ticketId, options);
}

module.exports = {
  listAgentTickets,
  countAgentTicketsByStatus,
  findAgentTicketById,
  updateAgentTicketStatus,
  listCustomerTickets,
  findCustomerTicketById,
  countOpenCustomerTickets,
  createTicket,
  findTicketById,
  listTickets,
  updateTicket,
  findAssignableAgent,
  listAssignableAgents,
};
