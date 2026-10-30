process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
process.env.JWT_COOKIE_SECURE = "false";
process.env.JWT_COOKIE_SAME_SITE = "lax";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../../src/app");
const { createAccessToken } = require("../../src/utils/token");

async function startTestServer(dependencies = {}) {
  const app = createApp(dependencies);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const baseContext = {
  userId: 20,
  firstName: "Casey",
  lastName: "Customer",
  email: "casey@customer.test",
  userStatus: "Active",
  roleName: "Customer",
  companyId: 7,
  companyName: "Acme",
  companyStatus: "Active",
};

const enabledSettings = {
  enabled: true,
  assistantName: "Acme Assistant",
  tone: "friendly",
  greeting: "Hi! Ask me anything.",
  answerFromFaqsOnly: true,
  confidenceThreshold: 70,
  escalateAfterFailures: 2,
  fallbackMessage: "Let me get a person to help.",
  customInstructions: "",
};

// In-memory chat store with the same behaviour as chatModel
function createMemoryChatModel() {
  const sessions = [];
  const messages = [];
  return {
    sessions,
    messages,
    createSession: async (companyId, customerId) => {
      const session = {
        sessionId: sessions.length + 1,
        companyId,
        customerId,
        status: "Active",
        failedAnswers: 0,
        ticketId: null,
        createdAt: new Date().toISOString(),
      };
      sessions.push(session);
      return { ...session };
    },
    findSession: async (companyId, customerId, sessionId) => {
      const found = sessions.find(
        (s) => s.companyId === companyId && s.customerId === customerId && s.sessionId === sessionId,
      );
      return found ? { ...found } : null;
    },
    findActiveSession: async (companyId, customerId) => {
      const found = [...sessions]
        .reverse()
        .find((s) => s.companyId === companyId && s.customerId === customerId && s.status === "Active");
      return found ? { ...found } : null;
    },
    updateSession: async (sessionId, changes) => {
      Object.assign(sessions.find((s) => s.sessionId === sessionId), changes);
    },
    addMessage: async (sessionId, sender, body, confidence = null) => {
      const message = { messageId: messages.length + 1, sessionId, sender, body, confidence };
      messages.push(message);
      return message;
    },
    listMessages: async (sessionId) => messages.filter((m) => m.sessionId === sessionId),
    findLeastBusyAgent: async () => ({ userId: 5, name: "Sam Agent", openTickets: 0 }),
    countOutcomes: async () => ({ resolved: 0, escalated: 0 }),
  };
}

test("customer AI chat API", async (context) => {
  let chatModel;
  let settings;
  let verdicts;
  let createdTickets;
  let openTicketCount;
  let orders;
  let responderRequests;

  const aiResponder = {
    isAiEnabled: () => false,
    respond: async (request) => {
      responderRequests.push(request);
      return { source: "test", ticketSubject: null, ticketPriority: "Medium", ...verdicts.shift() };
    },
  };
  const dependencies = {
    orderModel: {
      listCustomerOrders: async (companyId, customerId) => {
        assert.deepEqual([companyId, customerId], [7, 20]);
        if (orders instanceof Error) throw orders;
        return orders;
      },
    },
    customerModel: { findCustomerContext: async (userId) => (userId === 20 ? { ...baseContext } : null) },
    aiSettingsModel: { findAiSettings: async () => settings },
    faqModel: {
      listFaqs: async (_companyId, filters) => {
        assert.equal(filters.status, "published");
        return [{ faqId: 1, question: "How do I reset my password?", answer: "Use Forgot password.", category: "Account" }];
      },
    },
    ticketModel: {
      countOpenCustomerTickets: async () => openTicketCount,
      createTicket: async (companyId, input) => {
        const ticket = { ticketId: 900 + createdTickets.length, companyId, ...input };
        createdTickets.push(ticket);
        return ticket;
      },
    },
    aiResponder,
  };

  // The chat model is swapped per test, so resolve it lazily
  const lazyChatModel = new Proxy({}, { get: (_target, key) => (...args) => chatModel[key](...args) });
  const server = await startTestServer({ ...dependencies, chatModel: lazyChatModel });
  context.after(() => server.close());

  const call = (method, path, body, token = createAccessToken({ accountType: "individual", userId: 20, email: "casey@customer.test", roleName: "Customer" })) =>
    fetch(`${server.baseUrl}/api/customer/chat${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  context.beforeEach(() => {
    chatModel = createMemoryChatModel();
    settings = { ...enabledSettings };
    verdicts = [];
    createdTickets = [];
    openTicketCount = 0;
    orders = [];
    responderRequests = [];
  });

  await context.test("only signed-in customers can chat", async () => {
    assert.equal((await call("POST", "/sessions", undefined, null)).status, 401);
    const agentToken = createAccessToken({ accountType: "individual", userId: 5, email: "a@x.test", roleName: "Support Agent" });
    assert.equal((await call("POST", "/sessions", undefined, agentToken)).status, 403);
  });

  await context.test("starting a chat greets the customer and reuses the active session", async () => {
    const first = await (await call("POST", "/sessions")).json();
    assert.equal(first.data.session.status, "Active");
    assert.deepEqual(first.data.messages.map((m) => [m.sender, m.body]), [["assistant", "Hi! Ask me anything."]]);
    assert.equal(first.data.assistant.assistantName, "Acme Assistant");

    const again = await (await call("POST", "/sessions")).json();
    assert.equal(again.data.session.sessionId, first.data.session.sessionId);
    assert.equal(chatModel.sessions.length, 1);
  });

  await context.test("a disabled assistant sends customers to tickets instead", async () => {
    settings = { ...enabledSettings, enabled: false };
    const response = await call("POST", "/sessions");
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "ASSISTANT_DISABLED");
  });

  await context.test("a confident answer is returned and the chat stays open", async () => {
    const { data } = await (await call("POST", "/sessions")).json();
    verdicts.push({ answer: "Use Forgot password.", confidence: 92, needsHuman: false });

    const response = await call("POST", `/sessions/${data.session.sessionId}/messages`, { message: "How do I reset my password?" });
    const json = await response.json();
    assert.equal(response.status, 201);
    assert.deepEqual(json.data.messages.map((m) => m.sender), ["customer", "assistant"]);
    assert.equal(json.data.messages[1].body, "Use Forgot password.");
    assert.equal(json.data.session.status, "Active");
    assert.equal(createdTickets.length, 0);
  });

  await context.test("the assistant is given the customer's own orders", async () => {
    orders = [{ orderNumber: "AC-10517", status: "Shipped", items: [] }];
    const { data } = await (await call("POST", "/sessions")).json();
    verdicts.push({ answer: "Order AC-10517 has shipped.", confidence: 90, needsHuman: false });

    const response = await call("POST", `/sessions/${data.session.sessionId}/messages`, { message: "Where is my order?" });
    assert.equal(response.status, 201);
    assert.deepEqual(responderRequests[0].customer, { name: "Casey Customer", orders });
  });

  await context.test("a failed order lookup does not stop the chat", async () => {
    orders = new Error("orders table missing");
    const { data } = await (await call("POST", "/sessions")).json();
    verdicts.push({ answer: "Use Forgot password.", confidence: 92, needsHuman: false });

    const response = await call("POST", `/sessions/${data.session.sessionId}/messages`, { message: "Reset password?" });
    assert.equal(response.status, 201);
    assert.deepEqual(responderRequests[0].customer.orders, []);
  });

  await context.test("repeated low-confidence answers escalate to an assigned ticket with the transcript", async () => {
    const { data } = await (await call("POST", "/sessions")).json();
    const id = data.session.sessionId;
    verdicts.push(
      { answer: "I'm not sure.", confidence: 20, needsHuman: false },
      { answer: "Still not sure.", confidence: 10, needsHuman: false, ticketSubject: "Invoice download fails", ticketPriority: "High" },
    );

    const first = await (await call("POST", `/sessions/${id}/messages`, { message: "My invoice won't download" })).json();
    assert.equal(first.data.session.status, "Active");
    assert.equal(chatModel.sessions[0].failedAnswers, 1);

    const second = await (await call("POST", `/sessions/${id}/messages`, { message: "It still fails" })).json();
    assert.equal(second.data.session.status, "Escalated");
    assert.equal(second.data.ticket.ticketId, 900);
    assert.equal(second.data.ticket.assignedTo, "Sam Agent");
    assert.equal(second.data.messages[1].body, "Let me get a person to help.");
    assert.match(second.data.messages[2].body, /ticket #900/);

    const [ticket] = createdTickets;
    assert.equal(ticket.companyId, 7);
    assert.equal(ticket.customerId, 20);
    assert.equal(ticket.subject, "Invoice download fails");
    assert.equal(ticket.priority, "High");
    assert.equal(ticket.assignedAgentId, 5);
    assert.match(ticket.description, /Customer: My invoice won't download/);
    assert.match(ticket.description, /Assistant: I'm not sure\./);
  });

  await context.test("the AI asking for a human escalates immediately", async () => {
    const { data } = await (await call("POST", "/sessions")).json();
    verdicts.push({
      answer: "Sorry about the double charge. I'll pass this to our billing team.",
      confidence: 0,
      needsHuman: true,
      reason: "Refund request",
      ticketPriority: "Urgent",
    });

    const json = await (await call("POST", `/sessions/${data.session.sessionId}/messages`, { message: "I was charged twice!" })).json();
    assert.equal(json.data.session.status, "Escalated");
    assert.equal(json.data.messages[1].body, "Sorry about the double charge. I'll pass this to our billing team.");
    assert.equal(createdTickets[0].priority, "Urgent");
    assert.equal(createdTickets[0].subject, "I was charged twice!");
  });

  await context.test("customers can ask for a person or mark the chat resolved", async () => {
    let { data } = await (await call("POST", "/sessions")).json();
    const human = await (await call("POST", `/sessions/${data.session.sessionId}/escalate`)).json();
    assert.equal(human.data.session.status, "Escalated");
    assert.equal(createdTickets.length, 1);

    ({ data } = await (await call("POST", "/sessions")).json());
    assert.notEqual(data.session.sessionId, human.data.session.sessionId);
    const resolved = await (await call("POST", `/sessions/${data.session.sessionId}/resolve`)).json();
    assert.equal(resolved.data.session.status, "Resolved");

    const closed = await call("POST", `/sessions/${data.session.sessionId}/messages`, { message: "hello?" });
    assert.equal(closed.status, 409);
    assert.equal((await closed.json()).code, "CHAT_CLOSED");
  });

  await context.test("no ticket is created when the customer has reached the open-ticket limit", async () => {
    openTicketCount = 25;
    const { data } = await (await call("POST", "/sessions")).json();
    const json = await (await call("POST", `/sessions/${data.session.sessionId}/escalate`)).json();
    assert.equal(createdTickets.length, 0);
    assert.equal(json.data.ticket, null);
    assert.match(json.data.messages[0].body, /25 open tickets/);
  });

  await context.test("messages are validated and sessions are private", async () => {
    const { data } = await (await call("POST", "/sessions")).json();
    const empty = await call("POST", `/sessions/${data.session.sessionId}/messages`, { message: "   " });
    assert.equal(empty.status, 422);
    const tooLong = await call("POST", `/sessions/${data.session.sessionId}/messages`, { message: "x".repeat(2001) });
    assert.equal(tooLong.status, 422);

    chatModel.sessions.push({ sessionId: 99, companyId: 7, customerId: 21, status: "Active", failedAnswers: 0 });
    assert.equal((await call("GET", "/sessions/99")).status, 404);
    assert.equal((await call("GET", "/sessions/abc")).status, 400);
  });
});
