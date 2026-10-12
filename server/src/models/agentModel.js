const { getMySQLPool } = require("../config/database");
const AppError = require("../utils/AppError");
const { OPEN_STATUSES } = require("../constants/ticketConstants");
const {
  AGENT_STATUS_ACTIVE,
  AGENT_LIST_CAP,
} = require("../constants/agentConstants");

// Every function takes the company id first and scopes every statement with
// the company. The optional trailing `options.pool` exists for tests.
const OPEN_PLACEHOLDERS = OPEN_STATUSES.map(() => "?").join(", ");

const AGENT_SELECT = `SELECT
       u.user_id AS agentId,
       u.first_name AS firstName,
       u.last_name AS lastName,
       u.email AS email,
       u.account_status AS status,
       u.online_status AS onlineStatus,
       (u.password_hash IS NULL AND u.google_id IS NULL) AS invitePending,
       COALESCE(w.openTickets, 0) AS openTickets
     FROM users AS u
     INNER JOIN roles AS r ON r.role_id = u.role_id AND r.role_name = 'Support Agent'
     LEFT JOIN (
       SELECT assigned_agent_id, COUNT(*) AS openTickets
       FROM tickets
       WHERE company_id = ? AND status IN (${OPEN_PLACEHOLDERS})
       GROUP BY assigned_agent_id
     ) AS w ON w.assigned_agent_id = u.user_id`;

function poolFrom(options) {
  return options?.pool || getMySQLPool();
}

function toAgent(row) {
  return {
    agentId: row.agentId,
    firstName: row.firstName,
    lastName: row.lastName,
    name: [row.firstName, row.lastName].filter(Boolean).join(" ").trim(),
    email: row.email,
    status: row.status,
    onlineStatus: row.onlineStatus,
    invitePending: Number(row.invitePending) === 1 || row.invitePending === true,
    openTickets: Number(row.openTickets || 0),
  };
}

async function listAgents(companyId, options) {
  const [rows] = await poolFrom(options).query(
    `${AGENT_SELECT}
     WHERE u.company_id = ?
     ORDER BY u.account_status, u.first_name, u.last_name
     LIMIT ${AGENT_LIST_CAP}`,
    [companyId, ...OPEN_STATUSES, companyId],
  );

  return rows.map(toAgent);
}

async function findAgent(companyId, agentId, options) {
  const [rows] = await poolFrom(options).execute(
    `${AGENT_SELECT}
     WHERE u.company_id = ? AND u.user_id = ?
     LIMIT 1`,
    [companyId, ...OPEN_STATUSES, companyId, agentId],
  );

  return rows[0] ? toAgent(rows[0]) : null;
}

async function createAgent(companyId, agent, options) {
  let result;
  try {
    [result] = await poolFrom(options).execute(
      `INSERT INTO users
         (role_id, company_id, first_name, last_name, email, password_hash,
          online_status, account_status)
       SELECT role_id, ?, ?, ?, ?, NULL, 'Offline', ?
         FROM roles
        WHERE role_name = 'Support Agent'
        LIMIT 1`,
      [
        companyId,
        agent.firstName,
        agent.lastName,
        agent.email,
        AGENT_STATUS_ACTIVE,
      ],
    );
  } catch (error) {
    if (error?.code === "ER_BAD_NULL_ERROR") {
      throw new AppError(
        "Support Agent role is not configured",
        500,
        "AGENT_ROLE_MISSING",
      );
    }
    throw error;
  }

  if (!result?.affectedRows) {
    throw new AppError(
      "Support Agent role is not configured",
      500,
      "AGENT_ROLE_MISSING",
    );
  }

  if (!result?.insertId) {
    throw new Error("Agent insert did not return an id");
  }

  return findAgent(companyId, result.insertId, options);
}

async function setAgentStatus(companyId, agentId, status, options) {
  const [result] = await poolFrom(options).execute(
    `UPDATE users AS u
     INNER JOIN roles AS r ON r.role_id = u.role_id
     SET u.account_status = ?
     WHERE u.company_id = ? AND u.user_id = ? AND r.role_name = 'Support Agent'`,
    [status, companyId, agentId],
  );

  return result?.affectedRows || 0;
}

async function unassignOpenTickets(companyId, agentId, options) {
  const [result] = await poolFrom(options).execute(
    `UPDATE tickets SET assigned_agent_id = NULL
     WHERE company_id = ? AND assigned_agent_id = ?
       AND status IN (${OPEN_PLACEHOLDERS})`,
    [companyId, agentId, ...OPEN_STATUSES],
  );

  return result?.affectedRows || 0;
}

// Same shape as customerModel.findCustomerContext: the role and statuses are
// returned (not filtered) so the resolver can report why access is denied.
async function findAgentContext(userId, options) {
  const [rows] = await poolFrom(options).execute(
    `SELECT
       u.user_id AS userId,
       u.first_name AS firstName,
       u.last_name AS lastName,
       u.email AS email,
       u.account_status AS userStatus,
       r.role_name AS roleName,
       c.company_id AS companyId,
       c.company_name AS companyName,
       c.status AS companyStatus
     FROM users AS u
     INNER JOIN roles AS r ON r.role_id = u.role_id
     INNER JOIN companies AS c ON c.company_id = u.company_id
     WHERE u.user_id = ?
     LIMIT 1`,
    [userId],
  );

  return rows[0] || null;
}

module.exports = {
  listAgents,
  findAgent,
  createAgent,
  setAgentStatus,
  unassignOpenTickets,
  findAgentContext,
};
