const defaultCustomerModel = require("../models/customerModel");
const defaultTicketModel = require("../models/ticketModel");
const defaultFaqModel = require("../models/faqModel");
const defaultAiSettingsModel = require("../models/aiSettingsModel");
const AppError = require("../utils/AppError");
const { createCustomerContextResolver } = require("./customerContext");
const { resolveAiSettings } = require("./aiSettingsService");
const {
  validateCustomerCreateTicketPayload,
  validateCustomerTicketListQuery,
  validateFaqQuery,
  parseCustomerTicketId,
} = require("../validators/customerValidator");
const { DEFAULT_AI_SETTINGS } = require("../constants/aiSettingsConstants");
const { CUSTOMER_OPEN_TICKET_LIMIT } = require("../constants/customerConstants");

function validationError(errors) {
  return new AppError("Validation failed", 422, "VALIDATION_ERROR", errors);
}

// Whitelist: internal ids and requester details never reach the customer view
function toCustomerTicket(row) {
  return {
    ticketId: row.ticketId,
    subject: row.subject,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeName: row.assigneeName ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt ?? null,
  };
}

function toPublicFaq(row) {
  return {
    faqId: row.faqId,
    question: row.question,
    answer: row.answer,
    category: row.category ?? null,
  };
}

function createCustomerService(dependencies = {}) {
  const customerModel = dependencies.customerModel || defaultCustomerModel;
  const ticketModel = dependencies.ticketModel || defaultTicketModel;
  const faqModel = dependencies.faqModel || defaultFaqModel;
  const aiSettingsModel = dependencies.aiSettingsModel || defaultAiSettingsModel;
  const { requireActiveCustomer } = createCustomerContextResolver(customerModel);

  async function loadAssistant(companyId) {
    try {
      const settings = resolveAiSettings(
        await aiSettingsModel.findAiSettings(companyId),
      );
      return {
        enabled: Boolean(settings.enabled),
        assistantName: settings.assistantName,
        greeting: settings.greeting,
      };
    } catch (_error) {
      return {
        enabled: false,
        assistantName: DEFAULT_AI_SETTINGS.assistantName,
        greeting: DEFAULT_AI_SETTINGS.greeting,
      };
    }
  }

  async function getProfile(auth) {
    const context = await requireActiveCustomer(auth);
    return {
      customer: {
        userId: context.userId,
        firstName: context.firstName,
        lastName: context.lastName,
        email: context.email,
      },
      company: { companyId: context.companyId, companyName: context.companyName },
      assistant: await loadAssistant(context.companyId),
    };
  }

  async function listFaqs(auth, rawQuery) {
    const { companyId } = await requireActiveCustomer(auth);

    const { value, errors } = validateFaqQuery(rawQuery);
    if (errors.length > 0) throw validationError(errors);

    // Status is forced: customers only ever see published FAQs
    const rows = await faqModel.listFaqs(companyId, {
      status: "published",
      search: value.search,
      category: value.category,
    });
    const faqs = rows.map(toPublicFaq);
    const categories = [
      ...new Set(faqs.map((faq) => faq.category).filter(Boolean)),
    ].sort();

    return { faqs, categories };
  }

  async function listTickets(auth, rawQuery) {
    const { companyId, userId } = await requireActiveCustomer(auth);

    const { value, errors } = validateCustomerTicketListQuery(rawQuery);
    if (errors.length > 0) throw validationError(errors);

    const result = await ticketModel.listCustomerTickets(companyId, userId, value);
    const total = Number(result.total || 0);

    return {
      tickets: result.tickets.map(toCustomerTicket),
      pagination: {
        page: value.page,
        limit: value.limit,
        total,
        totalPages: Math.ceil(total / value.limit),
      },
    };
  }

  async function getTicket(auth, rawId) {
    const { companyId, userId } = await requireActiveCustomer(auth);

    const ticketId = parseCustomerTicketId(rawId);
    if (ticketId === null) {
      throw new AppError("Invalid ticket id", 400, "INVALID_TICKET_ID");
    }

    // Other customers' and other companies' tickets look exactly like missing ones
    const row = await ticketModel.findCustomerTicketById(companyId, userId, ticketId);
    if (!row) throw new AppError("Ticket not found", 404, "TICKET_NOT_FOUND");

    return { ticket: toCustomerTicket(row) };
  }

  async function createTicket(auth, body) {
    const context = await requireActiveCustomer(auth);

    const { value, errors } = validateCustomerCreateTicketPayload(body);
    if (errors.length > 0) throw validationError(errors);

    const open = await ticketModel.countOpenCustomerTickets(
      context.companyId,
      context.userId,
    );
    if (open >= CUSTOMER_OPEN_TICKET_LIMIT) {
      throw new AppError(
        `You can have at most ${CUSTOMER_OPEN_TICKET_LIMIT} open tickets. Please wait for some to be resolved.`,
        409,
        "TICKET_LIMIT_REACHED",
      );
    }

    const row = await ticketModel.createTicket(context.companyId, {
      customerId: context.userId,
      requesterName: [context.firstName, context.lastName]
        .filter(Boolean)
        .join(" ")
        .trim(),
      requesterEmail: context.email,
      subject: value.subject,
      description: value.description,
      status: "Open",
      priority: "Medium",
      assignedAgentId: null,
    });

    return { ticket: toCustomerTicket(row) };
  }

  return { getProfile, listFaqs, listTickets, getTicket, createTicket };
}

module.exports = { createCustomerService, toCustomerTicket };
