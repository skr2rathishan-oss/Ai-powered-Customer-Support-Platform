import { Navigate, Route, Routes } from "react-router";
import { ROUTES } from "./routes";
import { LandingPage } from "../pages/landing/LandingPage";
import { AuthPage } from "../pages/auth/AuthPage";
import { CompanyRegisterPage } from "../pages/auth/CompanyRegisterPage";
import { CompanyRouteGuard } from "../components/company/CompanyRouteGuard";
import { CompanyLayout } from "../components/company/CompanyLayout";
import { CompanyDashboardPage } from "../pages/company/CompanyDashboardPage";
import { CompanyComingSoonPage } from "../pages/company/CompanyComingSoonPage";
import { ResetPasswordPage } from "../pages/auth/ResetPasswordPage";
import { PlatformAdminDashboardPage } from "../pages/admin/PlatformAdminDashboardPage";
import { PlatformCompaniesPage } from "../pages/admin/PlatformCompaniesPage";
import { PlatformSettingsPage } from "../pages/admin/PlatformSettingsPage";

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

      {/* Password Reset */}
      <Route
        path={ROUTES.RESET_PASSWORD}
        element={<ResetPasswordPage />}
      />

      {/* Company Registration */}
      <Route
        path={ROUTES.REGISTER_COMPANY}
        element={<CompanyRegisterPage />}
      />

      {/* Company Portal (server-verified Company Admin only) */}
      <Route element={<CompanyRouteGuard />}>
        <Route element={<CompanyLayout />}>
          <Route
            path={ROUTES.DASHBOARD_COMPANY}
            element={<CompanyDashboardPage />}
          />
          <Route
            path={ROUTES.COMPANY_TICKETS}
            element={
              <CompanyComingSoonPage
                title="Tickets"
                icon="confirmation_number"
                description="Review, assign and resolve customer tickets in one place."
              />
            }
          />
          <Route
            path={ROUTES.COMPANY_AGENTS}
            element={
              <CompanyComingSoonPage
                title="Agents"
                icon="support_agent"
                description="Invite support agents and manage who handles which tickets."
              />
            }
          />
          <Route
            path={ROUTES.COMPANY_FAQS}
            element={
              <CompanyComingSoonPage
                title="FAQs"
                icon="quiz"
                description="Build the knowledge base your AI assistant answers from."
              />
            }
          />
          <Route
            path={ROUTES.COMPANY_AI_SETTINGS}
            element={
              <CompanyComingSoonPage
                title="AI Settings"
                icon="smart_toy"
                description="Tune how the AI assistant responds and when it hands off to a human."
              />
            }
          />
        </Route>
      </Route>

      {/* Platform Admin Dashboard */}
      <Route
        path={ROUTES.ADMIN_DASHBOARD}
        element={<PlatformAdminDashboardPage />}
      />

      {/* Platform Admin Companies Directory */}
      <Route
        path={ROUTES.ADMIN_COMPANIES}
        element={<PlatformCompaniesPage />}
      />

      {/* Platform Admin Settings & Telemetry */}
      <Route
        path={ROUTES.ADMIN_SETTINGS}
        element={<PlatformSettingsPage />}
      />

      {/* Fallback to Landing Page */}
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  );
}

