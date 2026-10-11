export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  LOGIN_COMPANY: "/login/company",
  COMPANY_LEGACY: "/company",
  REGISTER_COMPANY: "/company/register",
  DASHBOARD_COMPANY: "/company/dashboard",
  COMPANY_TICKETS: "/company/tickets",
  COMPANY_TICKET_DETAIL: "/company/tickets/:ticketId",
  COMPANY_AGENTS: "/company/agents",
  COMPANY_FAQS: "/company/faqs",
  COMPANY_AI_SETTINGS: "/company/ai-settings",
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_COMPANIES: "/admin/companies",
  ADMIN_SETTINGS: "/admin/settings",
  RESET_PASSWORD: "/reset-password",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export const companyTicketPath = (id: number | string) =>
  `/company/tickets/${id}`;
