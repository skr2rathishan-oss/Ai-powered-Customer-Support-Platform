import type { ReactNode } from "react";
import { Link } from "react-router";
import { ProductShowcase } from "./ProductShowcase";

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
        <Link className="brand" to="/" aria-label="SupportPilot home">
          <span className="brand__mark" aria-hidden="true">✦</span>
          <span id="brand-name">SupportPilot</span>
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
