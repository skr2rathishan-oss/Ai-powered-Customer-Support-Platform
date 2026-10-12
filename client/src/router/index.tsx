import { Navigate, Route, Routes } from "react-router";
import { ROUTES } from "./routes";
import { LandingPage } from "../pages/landing/LandingPage";
import { AuthPage } from "../pages/auth/AuthPage";
import { CompanyRegisterPage } from "../pages/auth/CompanyRegisterPage";
import { CompanyRouteGuard } from "../components/company/CompanyRouteGuard";
import { CompanyLayout } from "../components/company/CompanyLayout";
import { CompanyDashboardPage } from "../pages/company/CompanyDashboardPage";
import { CompanyAiSettingsPage } from "../pages/company/CompanyAiSettingsPage";
import { CompanyFaqsPage } from "../pages/company/CompanyFaqsPage";
import { CompanyAgentsPage } from "../pages/company/CompanyAgentsPage";
import { CompanyTicketsPage } from "../pages/company/CompanyTicketsPage";
import { CompanyTicketDetailPage } from "../pages/company/CompanyTicketDetailPage";
import { CustomerRegisterPage } from "../pages/auth/CustomerRegisterPage";
import { CustomerRouteGuard } from "../components/customer/CustomerRouteGuard";
import { CustomerLayout } from "../components/customer/CustomerLayout";
import { CustomerTicketsPage } from "../pages/customer/CustomerTicketsPage";
import { CustomerNewTicketPage } from "../pages/customer/CustomerNewTicketPage";
import { CustomerTicketDetailPage } from "../pages/customer/CustomerTicketDetailPage";
import { CustomerHelpPage } from "../pages/customer/CustomerHelpPage";
import { AgentRouteGuard } from "../components/agent/AgentRouteGuard";
import { AgentLayout } from "../components/agent/AgentLayout";
import { AgentQueuePage } from "../pages/agent/AgentQueuePage";
import { AgentTicketDetailPage } from "../pages/agent/AgentTicketDetailPage";
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

      {/* Customer Registration */}
      <Route
        path={ROUTES.REGISTER_CUSTOMER}
        element={<CustomerRegisterPage />}
      />

      {/* Customer Support Portal (server-verified Customer only) */}
      <Route element={<CustomerRouteGuard />}>
        <Route element={<CustomerLayout />}>
          <Route
            path="/support"
            element={<Navigate to={ROUTES.CUSTOMER_TICKETS} replace />}
          />
          <Route
            path={ROUTES.CUSTOMER_TICKETS}
            element={<CustomerTicketsPage />}
          />
          <Route
            path={ROUTES.CUSTOMER_NEW_TICKET}
            element={<CustomerNewTicketPage />}
          />
          <Route
            path={ROUTES.CUSTOMER_TICKET_DETAIL}
            element={<CustomerTicketDetailPage />}
          />
          <Route path={ROUTES.CUSTOMER_HELP} element={<CustomerHelpPage />} />
        </Route>
      </Route>

      {/* Agent Portal (server-verified Support Agent only) */}
      <Route
        path={ROUTES.AGENT_HOME}
        element={<Navigate to={ROUTES.AGENT_TICKETS} replace />}
      />
      <Route element={<AgentRouteGuard />}>
        <Route element={<AgentLayout />}>
          <Route path={ROUTES.AGENT_TICKETS} element={<AgentQueuePage />} />
          <Route
            path={ROUTES.AGENT_TICKET_DETAIL}
            element={<AgentTicketDetailPage />}
          />
        </Route>
      </Route>

      {/* Company Portal (server-verified Company Admin only) */}
      <Route element={<CompanyRouteGuard />}>
        <Route element={<CompanyLayout />}>
          <Route
            path={ROUTES.DASHBOARD_COMPANY}
            element={<CompanyDashboardPage />}
          />
          <Route
            path={ROUTES.COMPANY_TICKETS}
            element={<CompanyTicketsPage />}
          />
          <Route
            path={ROUTES.COMPANY_TICKET_DETAIL}
            element={<CompanyTicketDetailPage />}
          />
          <Route
            path={ROUTES.COMPANY_AGENTS}
            element={<CompanyAgentsPage />}
          />
          <Route
            path={ROUTES.COMPANY_FAQS}
            element={<CompanyFaqsPage />}
          />
          <Route
            path={ROUTES.COMPANY_AI_SETTINGS}
            element={<CompanyAiSettingsPage />}
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

