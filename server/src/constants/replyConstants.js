const REPLY_BODY_MAX = 5000;
const MAX_REPLIES_PER_TICKET = 500;
const REPLY_LIST_CAP = 500;
const AGENT_ROLE = "Support Agent";
const AGENT_SETTABLE_STATUSES = ["Open", "In Progress", "Resolved"];
const AGENT_SORTS = ["newest", "oldest", "priority"];

// Snapshot labels stored with each reply so history survives role changes
const AUTHOR_CUSTOMER = "Customer";
const AUTHOR_AGENT = "Agent";
const AUTHOR_ADMIN = "Admin";

module.exports = {
  REPLY_BODY_MAX,
  MAX_REPLIES_PER_TICKET,
  REPLY_LIST_CAP,
  AGENT_ROLE,
  AGENT_SETTABLE_STATUSES,
  AGENT_SORTS,
  AUTHOR_CUSTOMER,
  AUTHOR_AGENT,
  AUTHOR_ADMIN,
};
