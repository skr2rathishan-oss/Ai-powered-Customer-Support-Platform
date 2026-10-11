import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { ROUTES } from "../../router/routes";
import {
  ApiError,
  removeAuthToken,
  removeStoredUser,
} from "../../services/apiClient";
import { logout } from "../../services/auth";
import { getCustomerMe } from "../../services/customer";
import type { CustomerMe } from "../../types/customer";

type GuardState =
  | { status: "loading" }
  | { status: "ready"; data: CustomerMe }
  | { status: "forbidden"; message: string }
  | { status: "error"; message: string };

function errorCode(error: ApiError): string | null {
  const payload = error.payload as { code?: string } | null | undefined;
  return payload?.code ?? null;
}

function forbiddenMessage(code: string | null, fallback: string): string {
  switch (code) {
    case "COMPANY_INACTIVE":
      return "This company is not accepting support requests right now.";
    case "ACCOUNT_INACTIVE":
      return "Your account is not active. Contact the company's support team.";
    case "COMPANY_ACCESS_DENIED":
      return "No company is linked to this account.";
    case "ROLE_FORBIDDEN":
      return "This area is only available to customer accounts.";
    default:
      return fallback;
  }
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center p-6 text-center">
      {children}
    </div>
  );
}

export function CustomerRouteGuard() {
  const navigate = useNavigate();
  const [state, setState] = useState<GuardState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const handleUnauthenticated = useCallback(() => {
    removeAuthToken();
    removeStoredUser();
    navigate(ROUTES.LOGIN, { replace: true });
  }, [navigate]);

  useEffect(() => {
    let active = true;

    getCustomerMe()
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          handleUnauthenticated();
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          setState({
            status: "forbidden",
            message: forbiddenMessage(errorCode(error), error.message),
          });
          return;
        }
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "We could not load your support portal.",
        });
      });

    return () => {
      active = false;
    };
  }, [attempt, handleUnauthenticated]);

  if (state.status === "loading") {
    return (
      <CenteredCard>
        <div
          className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 border border-primary/20"
          role="status"
        >
          <span className="spinner" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-on-surface mb-1 font-display">
          Opening your support portal…
        </h2>
        <p className="text-sm text-outline">Verifying your account.</p>
      </CenteredCard>
    );
  }

  if (state.status === "error") {
    return (
      <CenteredCard>
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-outline-variant shadow-lg flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl">cloud_off</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2 font-display">
            Something went wrong
          </h2>
          <p className="text-sm text-outline leading-relaxed mb-6" role="alert">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all cursor-pointer"
          >
            Try again
          </button>
        </div>
      </CenteredCard>
    );
  }

  if (state.status === "forbidden") {
    return (
      <CenteredCard>
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-outline-variant shadow-lg flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl">block</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2 font-display">
            Access Restricted
          </h2>
          <p className="text-sm text-outline leading-relaxed mb-6">
            {state.message}
          </p>
          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate(ROUTES.LOGIN, { replace: true });
              }}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all text-center shadow-sm cursor-pointer"
            >
              Sign in with a customer account
            </button>
            <Link
              to={ROUTES.HOME}
              className="w-full py-2.5 rounded-xl border border-outline-variant text-outline font-semibold text-xs hover:bg-surface-container-low transition-all text-center no-underline"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </CenteredCard>
    );
  }

  return <Outlet context={{ data: state.data }} />;
}
