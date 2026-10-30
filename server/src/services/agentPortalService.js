const defaultAgentModel = require("../models/agentModel");
const defaultTicketModel = require("../models/ticketModel");
const defaultTicketReplyModel = require("../models/ticketReplyModel");
const AppError = require("../utils/AppError");
const { createAgentContextResolver } = require("./agentContext");
const {
  validateReplyPayload,
  validateAgentTicketListQuery,
  validateAgentStatusPayload,
} = require("../validators/replyValidator");
const { parseTicketId } = require("../validators/ticketValidator");
const {
  MAX_REPLIES_PER_TICKET,
  AUTHOR_AGENT,
} = require("../constants/replyConstants");

function validationError(errors) {
  return new AppError("Validation failed", 422, "VALIDATION_ERROR", errors);
}

const ticketNotFound = () => new AppError("Ticket not found", 404, "TICKET_NOT_FOUND");
const ticketClosed = () =>
  new AppError("This ticket is closed", 409, "TICKET_CLOSED");

function fullName(context) {
  return [context.firstName, context.lastName].filter(Boolean).join(" ").trim();
}

// Whitelist: no assignee or customer ids in agent views
function toAgentTicket(row) {
  return {
    ticketId: row.ticketId,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    requesterName: row.requesterName ?? null,
    requesterEmail: row.requesterEmail ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt ?? null,
  };
}

function toAgentTicketDetail(row) {
  return { ...toAgentTicket(row), description: row.description };
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

function createAgentPortalService(dependencies = {}) {
  const agentModel = dependencies.agentModel || defaultAgentModel;
  const ticketModel = dependencies.ticketModel || defaultTicketModel;
  const ticketReplyModel =
    dependencies.ticketReplyModel || defaultTicketReplyModel;
  const { requireActiveAgent } = createAgentContextResolver(agentModel);

  function requireTicketId(rawId) {
    const ticketId = parseTicketId(rawId);
    if (ticketId === null) {
      throw new AppError("Invalid ticket id", 400, "INVALID_TICKET_ID");
    }
    return ticketId;
  }

  async function findOwnTicket(context, ticketId) {
    // Unassigned, other agents' and other companies' tickets look like missing ones
    const row = await ticketModel.findAgentTicketById(
      context.companyId,
      context.userId,
      ticketId,
    );
    if (!row) throw ticketNotFound();
    return row;
  }

  async function getProfile(auth) {
    const context = await requireActiveAgent(auth);
    const summary = await ticketModel.countAgentTicketsByStatus(
      context.companyId,
      context.userId,
    );
    return {
      agent: {
        userId: context.userId,
        firstName: context.firstName,
        lastName: context.lastName,
        email: context.email,
      },
      company: { companyId: context.companyId, companyName: context.companyName },
      summary,
    };
  }

  async function listTickets(auth, rawQuery) {
    const context = await requireActiveAgent(auth);

    const { value, errors } = validateAgentTicketListQuery(rawQuery);
    if (errors.length > 0) throw validationError(errors);

    const [result, summary] = await Promise.all([
      ticketModel.listAgentTickets(context.companyId, context.userId, value),
      ticketModel.countAgentTicketsByStatus(context.companyId, context.userId),
    ]);
    const total = Number(result.total || 0);

    const ids = result.tickets.map((row) => row.ticketId);
    const activity = new Map(
      (await ticketReplyModel.lastReplyByTickets(context.companyId, ids)).map(
        (row) => [row.ticketId, row],
      ),
    );

    return {
      tickets: result.tickets.map((row) => {
        const last = activity.get(row.ticketId);
        return {
          ...toAgentTicket(row),
          replyCount: last ? Number(last.replyCount) : 0,
          lastReplyAt: last?.lastReplyAt ?? null,
          lastReplyRole: last?.lastReplyRole ?? null,
        };
      }),
      summary,
      pagination: {
        page: value.page,
        limit: value.limit,
        total,
        totalPages: Math.ceil(total / value.limit),
      },
    };
  }

  async function getTicket(auth, rawId) {
    const context = await requireActiveAgent(auth);
    const ticketId = requireTicketId(rawId);
    const row = await findOwnTicket(context, ticketId);

    const replies = await ticketReplyModel.listReplies(context.companyId, ticketId, {
      includeInternal: true,
    });

    return { ticket: toAgentTicketDetail(row), replies: replies.map(toStaffReply) };
  }

  async function createReply(auth, rawId, body) {
    const context = await requireActiveAgent(auth);
    const ticketId = requireTicketId(rawId);

    const { value, errors } = validateReplyPayload(body, { allowInternal: true });
    if (errors.length > 0) throw validationError(errors);

    const ticket = await findOwnTicket(context, ticketId);
    if (ticket.status === "Closed") throw ticketClosed();

    const count = await ticketReplyModel.countReplies(context.companyId, ticketId);
    if (count >= MAX_REPLIES_PER_TICKET) {
      throw new AppError(
        "This ticket has reached its reply limit",
        409,
        "REPLY_LIMIT_REACHED",
      );
    }

    const reply = await ticketReplyModel.createReply(context.companyId, ticketId, {
      authorId: context.userId,
      authorRole: AUTHOR_AGENT,
      authorName: fullName(context),
      isInternal: value.isInternal,
      body: value.body,
      requireAssignedAgentId: context.userId,
    });

    if (!reply) {
      // The conditional insert refused: reassigned, removed or closed meanwhile
      const again = await ticketModel.findAgentTicketById(
        context.companyId,
        context.userId,
        ticketId,
      );
      if (!again) throw ticketNotFound();
      throw ticketClosed();
    }

    return { reply: toStaffReply(reply) };
  }

  async function updateStatus(auth, rawId, body) {
    const context = await requireActiveAgent(auth);
    const ticketId = requireTicketId(rawId);

    const { value, errors } = validateAgentStatusPayload(body);
    if (errors.length > 0) throw validationError(errors);

    const ticket = await findOwnTicket(context, ticketId);
    if (ticket.status === "Closed") throw ticketClosed();
    if (ticket.status === value.status) {
      return { ticket: toAgentTicketDetail(ticket) };
    }

    const updated = await ticketModel.updateAgentTicketStatus(
      context.companyId,
      context.userId,
      ticketId,
      value.status,
    );
    if (!updated) {
      const again = await ticketModel.findAgentTicketById(
        context.companyId,
        context.userId,
        ticketId,
      );
      if (!again) throw ticketNotFound();
      throw ticketClosed();
    }

    return { ticket: toAgentTicketDetail(updated) };
  }

  return { getProfile, listTickets, getTicket, createReply, updateStatus };
}

module.exports = { createAgentPortalService, toStaffReply };
