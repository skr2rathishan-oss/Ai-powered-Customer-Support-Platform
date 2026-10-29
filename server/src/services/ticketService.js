const defaultTicketModel = require("../models/ticketModel");
const defaultCompanyPortalModel = require("../models/companyPortalModel");
const defaultTicketReplyModel = require("../models/ticketReplyModel");
const AppError = require("../utils/AppError");
const { createCompanyContextResolver } = require("./companyContext");
const { validateReplyPayload } = require("../validators/replyValidator");
const {
  MAX_REPLIES_PER_TICKET,
  AUTHOR_ADMIN,
} = require("../constants/replyConstants");
const {
  validateCreateTicketPayload,
  validateUpdateTicketPayload,
  validateListQuery,
  parseTicketId,
} = require("../validators/ticketValidator");

function validationError(errors) {
  return new AppError("Validation failed", 422, "VALIDATION_ERROR", errors);
}

function invalidAssignee() {
  return new AppError(
    "Assignee must be an active support agent of your company",
    422,
    "INVALID_ASSIGNEE",
    [
      {
        field: "assignedAgentId",
        message: "Assignee must be an active support agent of your company",
      },
    ],
  );
}

function ticketNotFound() {
  return new AppError("Ticket not found", 404, "TICKET_NOT_FOUND");
}

function requireTicketId(rawId) {
  const ticketId = parseTicketId(rawId);
  if (ticketId === null) {
    throw new AppError("Invalid ticket id", 400, "INVALID_TICKET_ID");
  }
  return ticketId;
}

function toStaffReply(row) {
  return {
    replyId: row.replyId,
    authorRole: row.authorRole,
    authorName: row.authorName ?? null,
    isInternal: Boolean(row.isInternal),
    body: row.body,
    createdAt: row.createdAt,
  };
}

function createTicketService(dependencies = {}) {
  const ticketModel = dependencies.ticketModel || defaultTicketModel;
  const ticketReplyModel =
    dependencies.ticketReplyModel || defaultTicketReplyModel;
  const portal = dependencies.companyPortalModel || defaultCompanyPortalModel;
  const { requireActiveCompanyAdmin } = createCompanyContextResolver(portal);

  async function assertAssignable(companyId, agentId) {
    const agent = await ticketModel.findAssignableAgent(companyId, agentId);
    if (!agent) throw invalidAssignee();
  }

  async function listTickets(auth, rawQuery) {
    const { companyId } = await requireActiveCompanyAdmin(auth);

    const { value, errors } = validateListQuery(rawQuery);
    if (errors.length > 0) throw validationError(errors);

    const result = await ticketModel.listTickets(companyId, value);
    const total = Number(result.total || 0);

    return {
      tickets: result.tickets,
      pagination: {
        page: value.page,
        limit: value.limit,
        total,
        totalPages: Math.ceil(total / value.limit),
      },
    };
  }

  async function getTicket(auth, rawId) {
    const { companyId } = await requireActiveCompanyAdmin(auth);
    const ticketId = requireTicketId(rawId);

    // Another company's ticket looks exactly like a missing one
    const ticket = await ticketModel.findTicketById(companyId, ticketId);
    if (!ticket) throw ticketNotFound();

    return ticket;
  }

  async function createTicket(auth, body) {
    const { companyId } = await requireActiveCompanyAdmin(auth);

    const { value, errors } = validateCreateTicketPayload(body);
    if (errors.length > 0) throw validationError(errors);

    if (value.assignedAgentId !== null) {
      await assertAssignable(companyId, value.assignedAgentId);
    }

    // customerId is never accepted from the client; customer submission sets it later
    return ticketModel.createTicket(companyId, { ...value, customerId: null });
  }

  async function updateTicket(auth, rawId, body) {
    const { companyId } = await requireActiveCompanyAdmin(auth);
    const ticketId = requireTicketId(rawId);

    const { value, errors } = validateUpdateTicketPayload(body);
    if (errors.length > 0) throw validationError(errors);

    const existing = await ticketModel.findTicketById(companyId, ticketId);
    if (!existing) throw ticketNotFound();

    if (typeof value.assignedAgentId === "number") {
      await assertAssignable(companyId, value.assignedAgentId);
    }

    const updated = await ticketModel.updateTicket(companyId, ticketId, value);
    if (!updated) throw ticketNotFound();

    return updated;
  }

  async function getTicketStats(auth) {
    const { companyId } = await requireActiveCompanyAdmin(auth);
    const days = 7;
    const raw = await ticketModel.getTicketStats(companyId, days);

    const byStatus = { open: 0, inProgress: 0, resolved: 0, closed: 0, total: 0 };
    const statusKeys = {
      Open: "open",
      "In Progress": "inProgress",
      Resolved: "resolved",
      Closed: "closed",
    };
    for (const row of raw.statusRows) {
      const total = Number(row.total || 0);
      if (statusKeys[row.status]) byStatus[statusKeys[row.status]] = total;
      byStatus.total += total;
    }

    const openByPriority = { Low: 0, Medium: 0, High: 0, Urgent: 0 };
    for (const row of raw.priorityRows) {
      if (row.priority in openByPriority) {
        openByPriority[row.priority] = Number(row.total || 0);
      }
    }

    // One entry per day, oldest first, including days with no tickets.
    // Day keys are UTC to match how the database groups created_at.
    const counts = new Map(raw.dailyRows.map((row) => [row.day, Number(row.total || 0)]));
    const createdPerDay = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - offset);
      const day = date.toISOString().slice(0, 10);
      createdPerDay.push({ day, total: counts.get(day) || 0 });
    }

    return {
      byStatus,
      openByPriority,
      unassigned: raw.unassigned,
      createdPerDay,
      agentWorkload: raw.agentRows.map((row) => ({
        userId: row.userId,
        name: [row.firstName, row.lastName].filter(Boolean).join(" ") || "Unnamed agent",
        onlineStatus: row.onlineStatus || "Offline",
        openTickets: Number(row.openTickets || 0),
      })),
    };
  }

  async function listAssignableAgents(auth) {
    const { companyId } = await requireActiveCompanyAdmin(auth);
    const agents = await ticketModel.listAssignableAgents(companyId);
    return { agents };
  }

  async function listReplies(auth, rawId) {
    const { companyId } = await requireActiveCompanyAdmin(auth);
    const ticketId = requireTicketId(rawId);

    const ticket = await ticketModel.findTicketById(companyId, ticketId);
    if (!ticket) throw ticketNotFound();

    const replies = await ticketReplyModel.listReplies(companyId, ticketId, {
      includeInternal: true,
    });
    return { replies: replies.map(toStaffReply) };
  }

  async function createReply(auth, rawId, body) {
    const context = await requireActiveCompanyAdmin(auth);
    const { companyId } = context;
    const ticketId = requireTicketId(rawId);

    const { value, errors } = validateReplyPayload(body, { allowInternal: true });
    if (errors.length > 0) throw validationError(errors);

    const ticket = await ticketModel.findTicketById(companyId, ticketId);
    if (!ticket) throw ticketNotFound();
    const closed = () => new AppError("This ticket is closed", 409, "TICKET_CLOSED");
    if (ticket.status === "Closed") throw closed();

    const count = await ticketReplyModel.countReplies(companyId, ticketId);
    if (count >= MAX_REPLIES_PER_TICKET) {
      throw new AppError(
        "This ticket has reached its reply limit",
        409,
        "REPLY_LIMIT_REACHED",
      );
    }

    const reply = await ticketReplyModel.createReply(companyId, ticketId, {
      authorId: context.userId,
      authorRole: AUTHOR_ADMIN,
      authorName: [context.firstName, context.lastName].filter(Boolean).join(" ").trim(),
      isInternal: value.isInternal,
      body: value.body,
    });
    if (!reply) throw closed();

    return { reply: toStaffReply(reply) };
  }

  return {
    listReplies,
    createReply,
    listTickets,
    getTicket,
    createTicket,
    updateTicket,
    listAssignableAgents,
    getTicketStats,
  };
}

module.exports = { createTicketService };
