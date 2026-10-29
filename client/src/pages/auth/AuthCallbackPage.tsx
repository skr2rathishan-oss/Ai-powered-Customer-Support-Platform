import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { homeForRole } from "../../router/roleRedirect";
import { ROUTES } from "../../router/routes";
import { apiRequest } from "../../services/apiClient";

interface MeResponse {
  data?: { user?: { email: string; roleName?: string; accountType?: string } };
}

/**
 * Landing route after the Google round-trip. The server has already set the
 * httpOnly auth cookie; no token is ever read from the URL.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    apiRequest<MeResponse>("/api/auth/me")
      .then((response) => {
        const user = response?.data?.user;
        if (!user) throw new Error("No session");

        window.dispatchEvent(
          new CustomEvent("supportpilot:authenticated", {
            detail: { mode: "individual", user },
          }),
        );
        navigate(homeForRole(user.roleName, user.accountType), {
          replace: true,
        });
      })
      .catch(() => {
        navigate(`${ROUTES.LOGIN}?error=google_auth_failed`, { replace: true });
      });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center p-6 text-center">
      <div
        className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 border border-primary/20"
        role="status"
      >
        <span className="spinner" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-bold text-on-surface mb-1 font-display">
        Finishing sign-in…
      </h2>
      <p className="text-sm text-outline">Just a moment.</p>
    </div>
  );
}
