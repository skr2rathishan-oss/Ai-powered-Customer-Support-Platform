// Shared support agent vocabulary.
const AGENT_STATUS_ACTIVE = "Active";
const AGENT_STATUS_INACTIVE = "Inactive";
const AGENT_STATUSES = [AGENT_STATUS_ACTIVE, AGENT_STATUS_INACTIVE];

const AGENT_NAME_MAX = 50;
const AGENT_EMAIL_MAX = 255;
const AGENT_LIST_CAP = 500;

// Invite links stay valid for 72 hours
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

module.exports = {
  AGENT_STATUS_ACTIVE,
  AGENT_STATUS_INACTIVE,
  AGENT_STATUSES,
  AGENT_NAME_MAX,
  AGENT_EMAIL_MAX,
  AGENT_LIST_CAP,
  INVITE_TTL_MS,
};
