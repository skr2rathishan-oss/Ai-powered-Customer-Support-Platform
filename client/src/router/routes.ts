export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  LOGIN_COMPANY: "/login/company",
  COMPANY_LEGACY: "/company",
  REGISTER_COMPANY: "/company/register",
  DASHBOARD_COMPANY: "/company/dashboard",
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_COMPANIES: "/admin/companies",
  ADMIN_SETTINGS: "/admin/settings",
  RESET_PASSWORD: "/reset-password",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

