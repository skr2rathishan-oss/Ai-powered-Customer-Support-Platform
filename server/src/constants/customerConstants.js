// Customer-facing support portal vocabulary and limits.
const CUSTOMER_ROLE = "Customer";
// Cheap abuse guard: a customer may have at most this many open tickets.
const CUSTOMER_OPEN_TICKET_LIMIT = 25;
const PUBLIC_COMPANY_LIMIT = 200;
const CUSTOMER_NAME_MAX = 60;
const FAQ_SEARCH_MAX = 100;
const FAQ_CATEGORY_MAX = 60;

module.exports = {
  CUSTOMER_ROLE,
  CUSTOMER_OPEN_TICKET_LIMIT,
  PUBLIC_COMPANY_LIMIT,
  CUSTOMER_NAME_MAX,
  FAQ_SEARCH_MAX,
  FAQ_CATEGORY_MAX,
};
