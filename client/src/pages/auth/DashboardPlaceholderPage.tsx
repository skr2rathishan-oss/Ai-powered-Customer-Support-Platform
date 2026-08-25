import { Link } from "react-router";
import { ROUTES } from "../../router/routes";

export function DashboardPlaceholderPage() {
  return (
    <main
      className="dashboard-placeholder"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/25 mb-4">
        <span className="material-symbols-outlined text-white text-2xl">
          flight_takeoff
        </span>
      </div>
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: "700",
          marginBottom: "0.5rem",
          color: "var(--on-surface)",
        }}
      >
        SupportPilot Dashboard
      </h1>
      <p
        style={{
          color: "var(--text-muted)",
          maxWidth: "480px",
          marginBottom: "1.5rem",
        }}
      >
        Your company workspace is active and authenticated. Support features
        are coming next!
      </p>
      <Link
        to={ROUTES.HOME}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 24px",
          borderRadius: "9999px",
          background: "var(--primary)",
          color: "#ffffff",
          textDecoration: "none",
          fontWeight: "600",
        }}
      >
        Back to Landing Page
      </Link>
    </main>
  );
}
