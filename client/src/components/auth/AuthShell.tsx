import type { ReactNode } from "react";
import { Link } from "react-router";
import { ProductShowcase } from "./ProductShowcase";
import { ROUTES } from "../../router/routes";

interface AuthShellProps {
  children: ReactNode;
  registration?: boolean;
}

export function AuthShell({
  children,
  registration = false,
}: AuthShellProps) {
  return (
    <main
      className={registration ? "auth-page auth-page--registration" : "auth-page"}
    >
      <section
        className={registration ? "auth-pane auth-pane--registration" : "auth-pane"}
        aria-labelledby="brand-name"
      >
        <div className="auth-pane__glow" aria-hidden="true" />
        <Link className="brand" to={ROUTES.HOME} aria-label="Back to SupportPilot home">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/20">
            <span className="material-symbols-outlined text-white text-lg">
              flight_takeoff
            </span>
          </div>
          <span id="brand-name" className="font-bold text-xl tracking-tight text-on-surface">
            SupportPilot
          </span>
        </Link>
        <div
          className={
            registration
              ? "auth-content auth-content--registration"
              : "auth-content"
          }
        >
          {children}
        </div>
      </section>
      <ProductShowcase />
    </main>
  );
}
