export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  LOGIN_COMPANY: "/login/company",
  COMPANY_LEGACY: "/company",
  REGISTER_COMPANY: "/company/register",
  REGISTER_CUSTOMER: "/register",
  CUSTOMER_TICKETS: "/support/tickets",
  CUSTOMER_NEW_TICKET: "/support/tickets/new",
  CUSTOMER_TICKET_DETAIL: "/support/tickets/:ticketId",
  CUSTOMER_HELP: "/support/help",
  DASHBOARD_COMPANY: "/company/dashboard",
  COMPANY_TICKETS: "/company/tickets",
  COMPANY_TICKET_DETAIL: "/company/tickets/:ticketId",
  COMPANY_AGENTS: "/company/agents",
  COMPANY_FAQS: "/company/faqs",
  COMPANY_AI_SETTINGS: "/company/ai-settings",
  AGENT_HOME: "/agent",
  AGENT_TICKETS: "/agent/tickets",
  AGENT_TICKET_DETAIL: "/agent/tickets/:ticketId",
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_COMPANIES: "/admin/companies",
  ADMIN_SETTINGS: "/admin/settings",
  RESET_PASSWORD: "/reset-password",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const companyTicketPath = (id: number | string) =>
  `/company/tickets/${id}`;

export const customerTicketPath = (id: number | string) =>
  `/support/tickets/${id}`;

export const agentTicketPath = (id: number | string) =>
  `/agent/tickets/${id}`;
