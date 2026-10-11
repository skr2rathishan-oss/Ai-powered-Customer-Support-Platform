// Shared company AI settings vocabulary, limits and defaults.
// Fixed invariant (not a setting): the assistant's knowledge source is ONLY
// `faqs` rows with is_published = 1 for the company.
const AI_TONES = ["friendly", "professional", "concise", "empathetic"];
const AI_ASSISTANT_NAME_MAX = 40;
const AI_GREETING_MAX = 300;
const AI_FALLBACK_MAX = 300;
const AI_INSTRUCTIONS_MAX = 1000;
const AI_CONFIDENCE_MIN = 0;
const AI_CONFIDENCE_MAX = 100;
const AI_ESCALATE_MIN = 1;
const AI_ESCALATE_MAX = 10;

const DEFAULT_AI_SETTINGS = Object.freeze({
  enabled: false,
  assistantName: "SupportPilot Assistant",
  tone: "professional",
  greeting: "Hi! How can I help you today?",
  answerFromFaqsOnly: true,
  confidenceThreshold: 70,
  escalateAfterFailures: 2,
  fallbackMessage: "I'm connecting you with a member of our support team.",
  customInstructions: "",
});

module.exports = {
  AI_TONES,
  AI_ASSISTANT_NAME_MAX,
  AI_GREETING_MAX,
  AI_FALLBACK_MAX,
  AI_INSTRUCTIONS_MAX,
  AI_CONFIDENCE_MIN,
  AI_CONFIDENCE_MAX,
  AI_ESCALATE_MIN,
  AI_ESCALATE_MAX,
  DEFAULT_AI_SETTINGS,
};
