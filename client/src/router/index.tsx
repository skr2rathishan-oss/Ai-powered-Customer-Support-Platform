import { Navigate, Route, Routes } from "react-router";
import { ROUTES } from "./routes";
import { LandingPage } from "../pages/landing/LandingPage";
import { AuthPage } from "../pages/auth/AuthPage";
import { CompanyRegisterPage } from "../pages/auth/CompanyRegisterPage";
import { DashboardPlaceholderPage } from "../pages/auth/DashboardPlaceholderPage";

export function AppRouter() {
  return (
    <Routes>
      {/* Root lands on the SupportPilot Landing Page */}
      <Route path={ROUTES.HOME} element={<LandingPage />} />

      {/* Auth Pages */}
      <Route path={ROUTES.LOGIN} element={<AuthPage mode="individual" />} />
      <Route
        path={ROUTES.LOGIN_COMPANY}
        element={<AuthPage mode="company" />}
      />
      {/* Legacy /company alias redirect */}
      <Route
        path={ROUTES.COMPANY_LEGACY}
        element={<Navigate to={ROUTES.LOGIN_COMPANY} replace />}
      />

      {/* Company Registration */}
      <Route
        path={ROUTES.REGISTER_COMPANY}
        element={<CompanyRegisterPage />}
      />

      {/* Company Dashboard */}
      <Route
        path={ROUTES.DASHBOARD_COMPANY}
        element={<DashboardPlaceholderPage />}
      />

      {/* Fallback to Landing Page */}
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  );
}

