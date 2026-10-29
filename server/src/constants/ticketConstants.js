// Shared ticket vocabulary. Values are stored as VARCHAR so they can evolve;
// the validators are what keep the stored values inside these lists.
const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const OPEN_STATUSES = ["Open", "In Progress"];
const CLOSED_STATUSES = ["Resolved", "Closed"];
const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

// Value of the `assignee` list filter that selects tickets with no agent.
const ASSIGNEE_UNASSIGNED = "unassigned";

const SUBJECT_MIN = 3;
const SUBJECT_MAX = 200;
const DESCRIPTION_MAX = 5000;
const REQUESTER_NAME_MAX = 150;
const REQUESTER_EMAIL_MAX = 255;
const SEARCH_MAX = 100;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

module.exports = {
  TICKET_STATUSES,
  OPEN_STATUSES,
  CLOSED_STATUSES,
  TICKET_PRIORITIES,
  ASSIGNEE_UNASSIGNED,
  SUBJECT_MIN,
  SUBJECT_MAX,
  DESCRIPTION_MAX,
  REQUESTER_NAME_MAX,
  REQUESTER_EMAIL_MAX,
  SEARCH_MAX,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
