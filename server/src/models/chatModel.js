const { getMySQLPool } = require("../config/database");

// Every session read is scoped by company and customer, so a customer can
// only ever reach their own conversations. `options.pool` exists for tests.
const SESSION_SELECT = `SELECT
       session_id AS sessionId,
       company_id AS companyId,
       customer_id AS customerId,
       status,
       failed_answers AS failedAnswers,
       ticket_id AS ticketId,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM chat_sessions`;

function poolFrom(options) {
  return options?.pool || getMySQLPool();
}

async function createSession(companyId, customerId, options) {
  const [result] = await poolFrom(options).execute(
    "INSERT INTO chat_sessions (company_id, customer_id) VALUES (?, ?)",
    [companyId, customerId],
  );
  return findSession(companyId, customerId, result.insertId, options);
}

async function findSession(companyId, customerId, sessionId, options) {
  const [rows] = await poolFrom(options).execute(
    `${SESSION_SELECT}
     WHERE company_id = ? AND customer_id = ? AND session_id = ?
     LIMIT 1`,
    [companyId, customerId, sessionId],
  );
  return rows[0] || null;
}

async function findActiveSession(companyId, customerId, options) {
  const [rows] = await poolFrom(options).execute(
    `${SESSION_SELECT}
     WHERE company_id = ? AND customer_id = ? AND status = 'Active'
     ORDER BY session_id DESC
     LIMIT 1`,
    [companyId, customerId],
  );
  return rows[0] || null;
}

async function updateSession(sessionId, changes, options) {
  const sets = [];
  const params = [];
  if (changes.status !== undefined) {
    sets.push("status = ?");
    params.push(changes.status);
  }
  if (changes.failedAnswers !== undefined) {
    sets.push("failed_answers = ?");
    params.push(changes.failedAnswers);
  }
  if (changes.ticketId !== undefined) {
    sets.push("ticket_id = ?");
    params.push(changes.ticketId);
  }
  if (sets.length === 0) return;
  await poolFrom(options).execute(
    `UPDATE chat_sessions SET ${sets.join(", ")} WHERE session_id = ?`,
    [...params, sessionId],
  );
}

async function addMessage(sessionId, sender, body, confidence = null, options) {
  const [result] = await poolFrom(options).execute(
    "INSERT INTO chat_messages (session_id, sender, body, confidence) VALUES (?, ?, ?, ?)",
    [sessionId, sender, body, confidence],
  );
  return {
    messageId: result.insertId,
    sender,
    body,
    confidence,
    createdAt: new Date().toISOString(),
  };
}

async function listMessages(sessionId, options) {
  const [rows] = await poolFrom(options).execute(
    `SELECT message_id AS messageId, sender, body, confidence, created_at AS createdAt
       FROM chat_messages
      WHERE session_id = ?
      ORDER BY message_id ASC`,
    [sessionId],
  );
  return rows;
}

// Routes an escalated chat to the active agent with the fewest open tickets,
// preferring agents who are online
async function findLeastBusyAgent(companyId, options) {
  const [rows] = await poolFrom(options).execute(
    `SELECT
       u.user_id AS userId,
       NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS name,
       COUNT(t.ticket_id) AS openTickets
     FROM users AS u
     INNER JOIN roles AS r ON r.role_id = u.role_id
     LEFT JOIN tickets AS t
       ON t.assigned_agent_id = u.user_id AND t.company_id = u.company_id
       AND t.status IN ('Open', 'In Progress')
     WHERE u.company_id = ? AND r.role_name = 'Support Agent'
       AND u.account_status = 'Active'
     GROUP BY u.user_id, u.first_name, u.last_name, u.online_status
     ORDER BY openTickets ASC, (u.online_status = 'Online') DESC, u.user_id ASC
     LIMIT 1`,
    [companyId],
  );
  return rows[0] || null;
}

async function countOutcomes(companyId, options) {
  const [rows] = await poolFrom(options).execute(
    `SELECT
       SUM(status = 'Resolved') AS resolved,
       SUM(status = 'Escalated') AS escalated
     FROM chat_sessions
     WHERE company_id = ?`,
    [companyId],
  );
  return {
    resolved: Number(rows[0]?.resolved || 0),
    escalated: Number(rows[0]?.escalated || 0),
  };
}

module.exports = {
  createSession,
  findSession,
  findActiveSession,
  updateSession,
  addMessage,
  listMessages,
  findLeastBusyAgent,
  countOutcomes,
};
