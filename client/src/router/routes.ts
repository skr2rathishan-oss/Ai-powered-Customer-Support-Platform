export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  LOGIN_COMPANY: "/login/company",
  COMPANY_LEGACY: "/company",
  REGISTER_COMPANY: "/company/register",
  DASHBOARD_COMPANY: "/company/dashboard",
  RESET_PASSWORD: "/reset-password",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

