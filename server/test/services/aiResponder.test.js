process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createAiResponder,
  buildSystemPrompt,
  buildCustomerContext,
  toChatMessages,
  parseVerdict,
  matchFaqs,
} = require("../../src/services/aiResponder");

const settings = {
  enabled: true,
  assistantName: "Acme Assistant",
  tone: "friendly",
  greeting: "Hi!",
  answerFromFaqsOnly: true,
  confidenceThreshold: 70,
  escalateAfterFailures: 2,
  fallbackMessage: "Connecting you with our team.",
  customInstructions: "",
};
const faqs = [
  { question: "How do I reset my password?", answer: "Use Forgot password on the sign-in page.", category: "Account" },
  { question: "What are your support hours?", answer: "Monday to Friday, 8am to 6pm.", category: "General" },
];
const history = [
  { sender: "assistant", body: "Hi!" },
  { sender: "customer", body: "How can I reset my password?" },
];

// Stands in for the openai client pointed at NVIDIA
function fakeClient(reply) {
  const requests = [];
  return {
    requests,
    chat: {
      completions: {
        create: async (request) => {
          requests.push(request);
          if (reply instanceof Error) throw reply;
          return reply;
        },
      },
    },
  };
}

function completion(content, finishReason = "stop") {
  return { choices: [{ finish_reason: finishReason, message: { role: "assistant", content } }] };
}

const goodVerdict = {
  answer: "Use Forgot password on the sign-in page.",
  confidence: 95,
  needs_human: false,
  reason: "Covered by FAQ 1",
  ticket_subject: "Password reset",
  ticket_priority: "Low",
};

test("the system prompt carries settings, FAQs and the reply format but nothing per-request", () => {
  const prompt = buildSystemPrompt({ companyName: "Acme", settings, faqs });
  assert.match(prompt, /Acme Assistant/);
  assert.match(prompt, /friendly tone/);
  assert.match(prompt, /Answer only from the help articles/);
  assert.match(prompt, /Q: What are your support hours\?/);
  assert.match(prompt, /Reply with a single JSON object/);
  assert.equal(prompt, buildSystemPrompt({ companyName: "Acme", settings, faqs }));
});

test("history maps to chat roles without system notices", () => {
  assert.deepEqual(
    toChatMessages([
      { sender: "assistant", body: "Hi!" },
      { sender: "customer", body: "One" },
      { sender: "system", body: "ignored" },
      { sender: "assistant", body: "Answer" },
    ]),
    [
      { role: "assistant", content: "Hi!" },
      { role: "user", content: "One" },
      { role: "assistant", content: "Answer" },
    ],
  );
});

test("verdicts are read from plain JSON, code fences and replies with reasoning", () => {
  assert.equal(parseVerdict(JSON.stringify(goodVerdict)).confidence, 95);
  assert.equal(parseVerdict("```json\n" + JSON.stringify(goodVerdict) + "\n```").answer, goodVerdict.answer);
  assert.equal(
    parseVerdict(`<think>The FAQ covers {this}.</think>\nHere you go: ${JSON.stringify(goodVerdict)}`).reason,
    "Covered by FAQ 1",
  );
  assert.equal(parseVerdict("Sorry, I can't help with that."), null);
  assert.equal(parseVerdict('{"answer": ""}'), null);
  assert.equal(parseVerdict("{not json}"), null);
});

test("the model's verdict is used and the request targets the configured model", async () => {
  const client = fakeClient(completion(JSON.stringify(goodVerdict)));
  const responder = createAiResponder({ client });
  const verdict = await responder.respond({ companyName: "Acme", settings, faqs, history });

  assert.deepEqual(verdict, {
    answer: "Use Forgot password on the sign-in page.",
    confidence: 95,
    needsHuman: false,
    reason: "Covered by FAQ 1",
    ticketSubject: "Password reset",
    ticketPriority: "Low",
    source: "ai",
  });

  const [request] = client.requests;
  assert.equal(request.model, "nvidia/nemotron-3-ultra-550b-a55b");
  assert.deepEqual(request.chat_template_kwargs, { enable_thinking: false });
  assert.deepEqual(request.response_format, { type: "json_object" });
  assert.equal(request.max_tokens, 1024);
  assert.equal(request.messages[0].role, "system");
  assert.deepEqual(request.messages.slice(1), [
    { role: "assistant", content: "Hi!" },
    { role: "user", content: "How can I reset my password?" },
  ]);
});

test("out-of-range values are clamped and unknown priorities default to Medium", async () => {
  const client = fakeClient(
    completion(JSON.stringify({ ...goodVerdict, confidence: 140, needs_human: "yes", ticket_priority: "Critical" })),
  );
  const verdict = await createAiResponder({ client }).respond({ companyName: "Acme", settings, faqs, history });
  assert.equal(verdict.confidence, 100);
  assert.equal(verdict.needsHuman, false);
  assert.equal(verdict.ticketPriority, "Medium");
});

test("a filtered or cut-off reply hands over to a human", async () => {
  for (const reason of ["length", "content_filter"]) {
    const responder = createAiResponder({ client: fakeClient(completion("{", reason)) });
    const verdict = await responder.respond({ companyName: "Acme", settings, faqs, history });
    assert.equal(verdict.needsHuman, true, reason);
    assert.equal(verdict.answer, settings.fallbackMessage);
  }
});

test("an unusable reply is retried once before giving up", async () => {
  const replies = [completion("Sure! Our hours are 8 to 6."), completion(JSON.stringify(goodVerdict))];
  const requests = [];
  const client = {
    chat: { completions: { create: async (request) => (requests.push(request), replies.shift()) } },
  };
  const verdict = await createAiResponder({ client }).respond({ companyName: "Acme", settings, faqs, history });
  assert.equal(verdict.source, "ai");
  assert.equal(verdict.confidence, 95);
  assert.equal(requests.length, 2);
});

test("API failures and unusable replies fall back to FAQ matching", async () => {
  for (const reply of [new Error("network down"), completion("I think you should reset it.")]) {
    const responder = createAiResponder({ client: fakeClient(reply) });
    const verdict = await responder.respond({ companyName: "Acme", settings, faqs, history });
    assert.equal(verdict.source, "faq-match");
    assert.equal(verdict.answer, faqs[0].answer);
  }
});

test("FAQ matching answers covered questions, flags unknown ones and human requests", () => {
  const hit = matchFaqs({ settings, faqs, question: "When are your support hours?" });
  assert.equal(hit.answer, faqs[1].answer);
  assert.ok(hit.confidence >= 70, `confidence ${hit.confidence}`);

  const miss = matchFaqs({ settings, faqs, question: "Do you ship to Mars?" });
  assert.equal(miss.confidence, 0);
  assert.equal(miss.needsHuman, false);

  const human = matchFaqs({ settings, faqs, question: "I want to talk to a real person, my account was hacked" });
  assert.equal(human.needsHuman, true);
  assert.equal(human.ticketPriority, "Urgent");
});

const orders = [
  {
    orderNumber: "AC-10517",
    status: "Shipped",
    shippingFee: 0,
    totalAmount: 13800,
    currency: "LKR",
    carrier: "Acme Express",
    trackingNumber: "AX7731942LK",
    orderedAt: "2026-10-27T09:00:00.000Z",
    estimatedDelivery: "2026-10-31",
    deliveredAt: null,
    items: [
      { productName: "Denim Trucker Jacket", size: "L", color: "Indigo", quantity: 1, unitPrice: 8900 },
      { productName: "Graphic Cotton T-Shirt", size: "L", color: "Black", quantity: 2, unitPrice: 2450 },
    ],
  },
  {
    orderNumber: "AC-10482",
    status: "Delivered",
    shippingFee: 0,
    totalAmount: 12700,
    currency: "LKR",
    orderedAt: "2026-10-12T09:00:00.000Z",
    estimatedDelivery: "2026-10-16",
    deliveredAt: "2026-10-15T14:00:00.000Z",
    items: [{ productName: "Classic Oxford Shirt", size: "M", color: "White", quantity: 2, unitPrice: 3950 }],
  },
];

test("the customer's orders are described in their own system message", () => {
  const text = buildCustomerContext({ name: "Casey Customer", orders }, new Date("2026-10-30T10:00:00Z"));
  assert.match(text, /Today is 2026-10-30\. You are talking to Casey Customer\./);
  assert.match(text, /<order number="AC-10517">/);
  assert.match(text, /tracking number: AX7731942LK/);
  assert.match(text, /estimated delivery: 2026-10-31/);
  assert.match(text, /2 x Graphic Cotton T-Shirt \(size L, Black\) at LKR 2,450\.00/);
  assert.match(text, /total: LKR 13,800\.00/);
  // A delivered order shows when it arrived, not the old estimate
  assert.match(text, /delivered: 2026-10-15/);
  assert.doesNotMatch(text, /estimated delivery: 2026-10-16/);

  assert.match(buildCustomerContext({ name: null, orders: [] }), /no orders/);
  assert.equal(buildCustomerContext(undefined), null);
});

test("orders are sent after the company prompt and before the conversation", async () => {
  const client = fakeClient(completion(JSON.stringify(goodVerdict)));
  await createAiResponder({ client }).respond({
    companyName: "Acme",
    settings,
    faqs,
    history,
    customer: { name: "Casey Customer", orders },
  });
  const [request] = client.requests;
  assert.deepEqual(request.messages.map((m) => m.role), ["system", "system", "assistant", "user"]);
  assert.match(request.messages[1].content, /AC-10517/);
  // The company prompt itself stays the same for every customer
  assert.equal(request.messages[0].content, buildSystemPrompt({ companyName: "Acme", settings, faqs }));
});

test("FAQ matching answers order status questions from the customer's orders", () => {
  const latest = matchFaqs({ settings, faqs, orders, question: "Where is my order?" });
  assert.equal(latest.confidence, 85);
  assert.match(latest.answer, /Order AC-10517 \(1 x Denim Trucker Jacket, 2 x Graphic Cotton T-Shirt\) has shipped with Acme Express \(tracking AX7731942LK\) and should arrive by 2026-10-31\./);
  assert.match(latest.answer, /Order AC-10482 .* was delivered on 2026-10-15\./);

  const byNumber = matchFaqs({ settings, faqs, orders, question: "status of ac-10482 please" });
  assert.match(byNumber.answer, /^Order AC-10482/);
  assert.doesNotMatch(byNumber.answer, /AC-10517/);

  // Unknown order numbers, order changes and customers without orders fall back to FAQs
  assert.equal(matchFaqs({ settings, faqs, orders, question: "Where is order AC-99999?" }).confidence, 0);
  assert.notEqual(matchFaqs({ settings, faqs, orders, question: "I want to cancel my order" }).confidence, 85);
  assert.notEqual(
    matchFaqs({ settings, faqs, orders, question: "My parcel was delivered to the wrong city" }).confidence,
    85,
  );
  assert.notEqual(matchFaqs({ settings, faqs, orders: [], question: "Where is my order?" }).confidence, 85);
});

test("without an NVIDIA API key the responder uses FAQ matching", async () => {
  const saved = process.env.NVIDIA_API_KEY;
  delete process.env.NVIDIA_API_KEY;
  try {
    const responder = createAiResponder();
    assert.equal(responder.isAiEnabled(), false);
    const verdict = await responder.respond({ companyName: "Acme", settings, faqs, history });
    assert.equal(verdict.source, "faq-match");
  } finally {
    if (saved !== undefined) process.env.NVIDIA_API_KEY = saved;
  }
});
