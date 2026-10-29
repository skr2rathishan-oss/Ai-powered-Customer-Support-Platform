const { getMySQLPool } = require("../config/database");

// Every statement is scoped by company_id. The optional trailing
// `options.pool` exists for tests. Column names are hard-coded.
const SETTINGS_SELECT = `SELECT
       enabled,
       assistant_name AS assistantName,
       tone,
       greeting,
       answer_from_faqs_only AS answerFromFaqsOnly,
       confidence_threshold AS confidenceThreshold,
       escalate_after_failures AS escalateAfterFailures,
       fallback_message AS fallbackMessage,
       custom_instructions AS customInstructions,
       updated_at AS updatedAt
     FROM company_ai_settings`;

function poolFrom(options) {
  return options?.pool || getMySQLPool();
}

function toSettings(row) {
  return {
    enabled: Boolean(Number(row.enabled)),
    assistantName: row.assistantName,
    tone: row.tone,
    greeting: row.greeting ?? "",
    answerFromFaqsOnly: Boolean(Number(row.answerFromFaqsOnly)),
    confidenceThreshold: Number(row.confidenceThreshold),
    escalateAfterFailures: Number(row.escalateAfterFailures),
    fallbackMessage: row.fallbackMessage ?? "",
    customInstructions: row.customInstructions ?? "",
    updatedAt: row.updatedAt ?? null,
  };
}

async function findAiSettings(companyId, options) {
  const [rows] = await poolFrom(options).execute(
    `${SETTINGS_SELECT}
     WHERE company_id = ?
     LIMIT 1`,
    [companyId],
  );
  return rows[0] ? toSettings(rows[0]) : null;
}

async function upsertAiSettings(companyId, userId, settings, options) {
  await poolFrom(options).execute(
    `INSERT INTO company_ai_settings
       (company_id, enabled, assistant_name, tone, greeting, answer_from_faqs_only,
        confidence_threshold, escalate_after_failures, fallback_message,
        custom_instructions, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled),
       assistant_name = VALUES(assistant_name),
       tone = VALUES(tone),
       greeting = VALUES(greeting),
       answer_from_faqs_only = VALUES(answer_from_faqs_only),
       confidence_threshold = VALUES(confidence_threshold),
       escalate_after_failures = VALUES(escalate_after_failures),
       fallback_message = VALUES(fallback_message),
       custom_instructions = VALUES(custom_instructions),
       updated_by = VALUES(updated_by)`,
    [
      companyId,
      settings.enabled ? 1 : 0,
      settings.assistantName,
      settings.tone,
      settings.greeting,
      settings.answerFromFaqsOnly ? 1 : 0,
      settings.confidenceThreshold,
      settings.escalateAfterFailures,
      settings.fallbackMessage,
      settings.customInstructions ? settings.customInstructions : null,
      userId ?? null,
    ],
  );
  return findAiSettings(companyId, options);
}

module.exports = { findAiSettings, upsertAiSettings };
