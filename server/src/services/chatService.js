const defaultChatModel = require("../models/chatModel");
const defaultCustomerModel = require("../models/customerModel");
const defaultTicketModel = require("../models/ticketModel");
const defaultFaqModel = require("../models/faqModel");
const defaultAiSettingsModel = require("../models/aiSettingsModel");
const defaultOrderModel = require("../models/orderModel");
const AppError = require("../utils/AppError");
const { createCustomerContextResolver } = require("./customerContext");
const { resolveAiSettings } = require("./aiSettingsService");
const { createAiResponder } = require("./aiResponder");
const { CUSTOMER_OPEN_TICKET_LIMIT } = require("../constants/customerConstants");
const { SUBJECT_MAX, DESCRIPTION_MAX } = require("../constants/ticketConstants");

const MESSAGE_MAX = 2000;
const MESSAGES_PER_SESSION_MAX = 60;

function parseSessionId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid chat session id", 400, "INVALID_SESSION_ID");
  }
  return id;
}

function validateMessage(body) {
  const text = typeof body?.message === "string" ? body.message.trim() : "";
  if (!text) {
    throw new AppError("Validation failed", 422, "VALIDATION_ERROR", [
      { field: "message", message: "Please type a message" },
    ]);
  }
  if (text.length > MESSAGE_MAX) {
    throw new AppError("Validation failed", 422, "VALIDATION_ERROR", [
      { field: "message", message: `Messages can be at most ${MESSAGE_MAX} characters` },
    ]);
  }
  return text;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function toSession(row) {
  return {
    sessionId: row.sessionId,
    status: row.status,
    ticketId: row.ticketId ?? null,
    createdAt: row.createdAt,
  };
}

function createChatService(dependencies = {}) {
  const chatModel = dependencies.chatModel || defaultChatModel;
  const customerModel = dependencies.customerModel || defaultCustomerModel;
  const ticketModel = dependencies.ticketModel || defaultTicketModel;
  const faqModel = dependencies.faqModel || defaultFaqModel;
  const aiSettingsModel = dependencies.aiSettingsModel || defaultAiSettingsModel;
  const orderModel = dependencies.orderModel || defaultOrderModel;
  const aiResponder = dependencies.aiResponder || createAiResponder(dependencies);
  const { requireActiveCustomer } = createCustomerContextResolver(customerModel);

  async function loadSettings(companyId) {
    return resolveAiSettings(await aiSettingsModel.findAiSettings(companyId));
  }

  // Orders only enrich the answer, so a failed lookup must not break the chat
  async function loadOrders(context) {
    try {
      return await orderModel.listCustomerOrders(context.companyId, context.userId);
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[AI] Could not load the customer's orders:", error.message);
      }
      return [];
    }
  }

  function assistantInfo(settings) {
    return {
      enabled: Boolean(settings.enabled),
      assistantName: settings.assistantName,
      poweredBy: aiResponder.isAiEnabled() ? "ai" : "faq-match",
    };
  }

  async function requireSession(context, rawId) {
    const session = await chatModel.findSession(context.companyId, context.userId, parseSessionId(rawId));
    if (!session) throw new AppError("Chat session not found", 404, "CHAT_NOT_FOUND");
    return session;
  }

  function requireActive(session) {
    if (session.status !== "Active") {
      throw new AppError("This conversation has ended. Start a new chat.", 409, "CHAT_CLOSED");
    }
  }

  /** Opens the customer's active conversation, or starts one with the greeting. */
  async function startSession(auth) {
    const context = await requireActiveCustomer(auth);
    const settings = await loadSettings(context.companyId);
    if (!settings.enabled) {
      throw new AppError(
        "The assistant is not available right now. Please open a ticket instead.",
        409,
        "ASSISTANT_DISABLED",
      );
    }

    let session = await chatModel.findActiveSession(context.companyId, context.userId);
    if (!session) {
      session = await chatModel.createSession(context.companyId, context.userId);
      await chatModel.addMessage(
        session.sessionId,
        "assistant",
        settings.greeting || `Hi ${context.firstName || "there"}! How can I help you today?`,
      );
    }

    return {
      session: toSession(session),
      messages: await chatModel.listMessages(session.sessionId),
      assistant: assistantInfo(settings),
    };
  }

  async function getSession(auth, rawId) {
    const context = await requireActiveCustomer(auth);
    const session = await requireSession(context, rawId);
    return {
      session: toSession(session),
      messages: await chatModel.listMessages(session.sessionId),
      assistant: assistantInfo(await loadSettings(context.companyId)),
    };
  }

  /**
   * Hands the conversation to a human: creates a ticket with the transcript,
   * assigns the least busy agent and closes the chat as Escalated.
   */
  async function escalate(context, session, { reason, subject, priority }) {
    const messages = await chatModel.listMessages(session.sessionId);

    const open = await ticketModel.countOpenCustomerTickets(context.companyId, context.userId);
    if (open >= CUSTOMER_OPEN_TICKET_LIMIT) {
      const notice = await chatModel.addMessage(
        session.sessionId,
        "system",
        `You already have ${CUSTOMER_OPEN_TICKET_LIMIT} open tickets, so a new one could not be created. Our team will reply on your existing tickets.`,
      );
      return { added: [notice], ticket: null };
    }

    const firstQuestion = messages.find((m) => m.sender === "customer")?.body || "Support request";
    const transcript = messages
      .filter((m) => m.sender !== "system")
      .map((m) => `${m.sender === "customer" ? "Customer" : "Assistant"}: ${m.body}`)
      .join("\n");
    const description = truncate(
      `Escalated from AI chat #${session.sessionId}.\nReason: ${reason}\n\nConversation:\n${transcript}`,
      DESCRIPTION_MAX,
    );

    const agent = await chatModel.findLeastBusyAgent(context.companyId);
    const ticket = await ticketModel.createTicket(context.companyId, {
      customerId: context.userId,
      requesterName: [context.firstName, context.lastName].filter(Boolean).join(" ").trim(),
      requesterEmail: context.email,
      // Without a subject from the AI, the customer's opening message describes the issue best
      subject: subject
        ? truncate(subject.replace(/\s+/g, " ").trim(), SUBJECT_MAX)
        : truncate(firstQuestion.replace(/\s+/g, " ").trim(), 100),
      description,
      status: "Open",
      priority: priority || "Medium",
      assignedAgentId: agent?.userId ?? null,
    });

    await chatModel.updateSession(session.sessionId, { status: "Escalated", ticketId: ticket.ticketId });
    const handoff = await chatModel.addMessage(
      session.sessionId,
      "system",
      agent
        ? `I've created ticket #${ticket.ticketId} and ${agent.name || "a support agent"} from our team will take it from here. You'll see their reply on the ticket.`
        : `I've created ticket #${ticket.ticketId}. A member of our support team will reply on the ticket soon.`,
    );

    return { added: [handoff], ticket: { ticketId: ticket.ticketId, assignedTo: agent?.name ?? null } };
  }

  async function sendMessage(auth, rawId, body) {
    const context = await requireActiveCustomer(auth);
    const text = validateMessage(body);
    const session = await requireSession(context, rawId);
    requireActive(session);

    const settings = await loadSettings(context.companyId);
    const history = await chatModel.listMessages(session.sessionId);
    if (history.length >= MESSAGES_PER_SESSION_MAX) {
      throw new AppError("This conversation is too long. Please talk to our team instead.", 409, "CHAT_TOO_LONG");
    }

    const customerMessage = await chatModel.addMessage(session.sessionId, "customer", text);
    const added = [customerMessage];

    const [faqs, orders] = await Promise.all([
      faqModel.listFaqs(context.companyId, { status: "published" }),
      loadOrders(context),
    ]);
    const verdict = await aiResponder.respond({
      companyName: context.companyName,
      settings,
      faqs,
      history: [...history, customerMessage],
      customer: {
        name: [context.firstName, context.lastName].filter(Boolean).join(" ").trim() || null,
        orders,
      },
    });

    const confident = verdict.confidence >= settings.confidenceThreshold;
    const failedAnswers = confident ? session.failedAnswers : session.failedAnswers + 1;
    const shouldEscalate =
      verdict.needsHuman || (!confident && failedAnswers >= settings.escalateAfterFailures);

    // When the assistant itself asked for a person its reply already explains
    // the handoff; when it simply ran out of answers, use the company's message
    const reply = shouldEscalate && !verdict.needsHuman ? settings.fallbackMessage : verdict.answer;
    added.push(await chatModel.addMessage(session.sessionId, "assistant", reply, verdict.confidence));

    let ticket = null;
    if (shouldEscalate) {
      const result = await escalate(context, session, {
        reason: verdict.reason || "The assistant could not resolve the question.",
        subject: verdict.ticketSubject,
        priority: verdict.ticketPriority,
      });
      added.push(...result.added);
      ticket = result.ticket;
    } else if (failedAnswers !== session.failedAnswers) {
      await chatModel.updateSession(session.sessionId, { failedAnswers });
    }

    const current = await chatModel.findSession(context.companyId, context.userId, session.sessionId);
    return { session: toSession(current), messages: added, ticket, source: verdict.source };
  }

  async function requestHuman(auth, rawId) {
    const context = await requireActiveCustomer(auth);
    const session = await requireSession(context, rawId);
    requireActive(session);

    const result = await escalate(context, session, {
      reason: "The customer asked to talk to a person.",
      subject: null,
      priority: "Medium",
    });
    const current = await chatModel.findSession(context.companyId, context.userId, session.sessionId);
    return { session: toSession(current), messages: result.added, ticket: result.ticket };
  }

  async function markResolved(auth, rawId) {
    const context = await requireActiveCustomer(auth);
    const session = await requireSession(context, rawId);
    requireActive(session);

    await chatModel.updateSession(session.sessionId, { status: "Resolved" });
    const message = await chatModel.addMessage(
      session.sessionId,
      "system",
      "Glad I could help! This conversation is now closed.",
    );
    const current = await chatModel.findSession(context.companyId, context.userId, session.sessionId);
    return { session: toSession(current), messages: [message], ticket: null };
  }

  return { startSession, getSession, sendMessage, requestHuman, markResolved };
}

module.exports = { createChatService, MESSAGE_MAX };
