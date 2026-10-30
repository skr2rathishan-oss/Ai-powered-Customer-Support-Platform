import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { ROUTES } from "../../router/routes";
import {
  ApiError,
  getStoredUser,
  removeAuthToken,
  removeStoredUser,
} from "../../services/apiClient";
import { logout } from "../../services/auth";
import { getCompanyMe } from "../../services/company";
import type { CompanyMeData } from "../../types/company";
import { WorkspaceLink } from "../common/WorkspaceLink";

type GuardState =
  | { status: "loading" }
  | { status: "ready"; data: CompanyMeData }
  | { status: "forbidden"; code: string | null; message: string }
  | { status: "error"; message: string };

function errorCode(error: ApiError): string | null {
  const payload = error.payload as { code?: string } | null | undefined;
  return payload?.code ?? null;
}

function forbiddenMessage(code: string | null, fallback: string): string {
  switch (code) {
    case "COMPANY_INACTIVE":
      return "Your company account is not active. Contact SupportPilot support to restore access.";
    case "ACCOUNT_INACTIVE":
      return "Your administrator account is not active. Contact your company owner or SupportPilot support.";
    case "COMPANY_ACCESS_DENIED":
      return "No company workspace is linked to this account.";
    case "ROLE_FORBIDDEN":
      return "This area is only available to company administrators.";
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

export function CompanyRouteGuard() {
  const navigate = useNavigate();
  const [state, setState] = useState<GuardState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const handleUnauthenticated = useCallback(() => {
    removeAuthToken();
    removeStoredUser();
    navigate(ROUTES.LOGIN_COMPANY, { replace: true });
  }, [navigate]);

  useEffect(() => {
    let active = true;

    getCompanyMe()
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
          const code = errorCode(error);
          setState({
            status: "forbidden",
            code,
            message: forbiddenMessage(code, error.message),
          });
          return;
        }
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "We could not load your company workspace.",
        });
      });

    return () => {
      active = false;
    };
  }, [attempt, handleUnauthenticated]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const data = await getCompanyMe();
      setState({ status: "ready", data });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthenticated();
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        setAttempt((value) => value + 1);
        return;
      }
      setRefreshError(
        error instanceof Error ? error.message : "Unable to refresh right now.",
      );
    } finally {
      setRefreshing(false);
    }
  }, [handleUnauthenticated]);

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
          Opening your workspace…
        </h2>
        <p className="text-sm text-outline">Verifying your company access.</p>
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
    // Only used to tailor the links shown; the server already refused access.
    const storedRole = (
      getStoredUser<{ roleName?: string }>()?.roleName ?? ""
    ).toLowerCase();
    const isPlatformAdmin = storedRole.includes("platform");

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
            {!isPlatformAdmin && (
              <WorkspaceLink areaHome={ROUTES.DASHBOARD_COMPANY} />
            )}
            {isPlatformAdmin ? (
              <Link
                to={ROUTES.ADMIN_DASHBOARD}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all text-center no-underline shadow-sm"
              >
                Go to Platform Admin
              </Link>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate(ROUTES.LOGIN_COMPANY, { replace: true });
                }}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all text-center shadow-sm cursor-pointer"
              >
                Sign in as Company Admin
              </button>
            )}
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

  return (
    <Outlet
      context={{ data: state.data, refresh, refreshing, refreshError }}
    />
  );
}
