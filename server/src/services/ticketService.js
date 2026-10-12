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
  };
}

module.exports = { createTicketService };
