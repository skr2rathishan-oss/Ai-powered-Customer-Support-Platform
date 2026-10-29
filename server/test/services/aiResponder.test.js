process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createAiResponder,
  buildSystemPrompt,
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
