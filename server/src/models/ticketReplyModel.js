const { getMySQLPool } = require("../config/database");
const { REPLY_LIST_CAP } = require("../constants/replyConstants");

// Every function takes the company id first and scopes every statement with
// `company_id = ?`. The optional trailing `options.pool` exists for tests.
const REPLY_SELECT = `SELECT
       reply_id AS replyId,
       author_id AS authorId,
       author_role AS authorRole,
       author_name AS authorName,
       is_internal AS isInternal,
       body AS body,
       created_at AS createdAt
     FROM ticket_replies`;

function poolFrom(options) {
  return options?.pool || getMySQLPool();
}

function toReply(row) {
  return { ...row, isInternal: Number(row.isInternal) === 1 || row.isInternal === true };
}

// Customer-facing callers pass includeInternal: false and the SQL itself
// excludes internal notes; nothing is filtered in JavaScript.
async function listReplies(companyId, ticketId, { includeInternal = false } = {}, options) {
  const visibility = includeInternal ? "" : " AND is_internal = 0";
  const [rows] = await poolFrom(options).query(
    `${REPLY_SELECT}
     WHERE company_id = ? AND ticket_id = ?${visibility}
     ORDER BY created_at ASC, reply_id ASC
     LIMIT ${REPLY_LIST_CAP}`,
    [companyId, ticketId],
  );

  return rows.map(toReply);
}

async function findReplyById(companyId, replyId, options) {
  const [rows] = await poolFrom(options).execute(
    `${REPLY_SELECT}
     WHERE company_id = ? AND reply_id = ?
     LIMIT 1`,
    [companyId, replyId],
  );

  return rows[0] ? toReply(rows[0]) : null;
}

// One conditional statement closes the closed-ticket and reassignment races:
// nothing is inserted when the ticket is Closed or (for agents) not assigned.
async function createReply(companyId, ticketId, reply, options) {
  const params = [
    companyId,
    ticketId,
    reply.authorId ?? null,
    reply.authorRole,
    reply.authorName ?? null,
    reply.isInternal ? 1 : 0,
    reply.body,
    companyId,
    ticketId,
  ];
  let assignment = "";
  if (reply.requireAssignedAgentId !== undefined) {
    assignment = " AND assigned_agent_id = ?";
    params.push(reply.requireAssignedAgentId);
  }

  const [result] = await poolFrom(options).execute(
    `INSERT INTO ticket_replies
       (company_id, ticket_id, author_id, author_role, author_name, is_internal, body)
     SELECT ?, ?, ?, ?, ?, ?, ?
       FROM tickets
      WHERE company_id = ? AND ticket_id = ? AND status <> 'Closed'${assignment}
      LIMIT 1`,
    params,
  );

  if (!result?.affectedRows) return null;
  return findReplyById(companyId, result.insertId, options);
}

async function countReplies(companyId, ticketId, options) {
  const [rows] = await poolFrom(options).execute(
    `SELECT COUNT(*) AS total FROM ticket_replies
     WHERE company_id = ? AND ticket_id = ?`,
    [companyId, ticketId],
  );

  return Number(rows[0]?.total || 0);
}

// Public replies only, one grouped query for a page of tickets
async function lastReplyByTickets(companyId, ticketIds, options) {
  if (!Array.isArray(ticketIds) || ticketIds.length === 0) return [];
  const placeholders = ticketIds.map(() => "?").join(", ");
  const [rows] = await poolFrom(options).execute(
    `SELECT
       r.ticket_id AS ticketId,
       s.replyCount AS replyCount,
       r.created_at AS lastReplyAt,
       r.author_role AS lastReplyRole
     FROM ticket_replies AS r
     INNER JOIN (
       SELECT ticket_id, COUNT(*) AS replyCount, MAX(reply_id) AS lastId
       FROM ticket_replies
       WHERE company_id = ? AND is_internal = 0 AND ticket_id IN (${placeholders})
       GROUP BY ticket_id
     ) AS s ON s.lastId = r.reply_id
     WHERE r.company_id = ?`,
    [companyId, ...ticketIds, companyId],
  );

  return rows.map((row) => ({ ...row, replyCount: Number(row.replyCount) }));
}

module.exports = {
  listReplies,
  createReply,
  countReplies,
  lastReplyByTickets,
};
