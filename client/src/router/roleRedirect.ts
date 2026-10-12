import { ROUTES } from "./routes";

/**
 * Home route for a signed-in account. Precedence is platform admin, company
 * admin (or a company-mode login), customer, support agent; anything else
 * falls back to the landing page.
 */
export function homeForRole(roleName?: string, accountType?: string): string {
  const role = (roleName || "").toLowerCase().trim();
  if (role === "platform admin" || role.includes("platform")) {
    return ROUTES.ADMIN_DASHBOARD;
  }
  if (
    accountType === "company" ||
    role === "company admin" ||
    role.includes("company")
  ) {
    return ROUTES.DASHBOARD_COMPANY;
  }
  if (role === "customer") return ROUTES.CUSTOMER_TICKETS;
  if (role === "support agent") return ROUTES.AGENT_TICKETS;
  return ROUTES.HOME;
}
