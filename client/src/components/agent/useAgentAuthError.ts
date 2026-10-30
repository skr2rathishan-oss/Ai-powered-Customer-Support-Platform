import { useCallback } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "../../router/routes";
import {
  ApiError,
  removeAuthToken,
  removeStoredUser,
} from "../../services/apiClient";

/**
 * Returns a handler for mid-session auth failures. On 401, or a 403 that means
 * the account was deactivated meanwhile, it clears the stored session and
 * redirects to login. Returns true when the error was handled.
 */
export function useAgentAuthError(): (error: unknown) => boolean {
  const navigate = useNavigate();

  return useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) return false;
      const code = (error.payload as { code?: string } | null | undefined)?.code;
      const inactive =
        error.status === 403 &&
        (code === "ACCOUNT_INACTIVE" ||
          code === "COMPANY_INACTIVE" ||
          code === "ROLE_FORBIDDEN" ||
          code === "COMPANY_ACCESS_DENIED");
      if (error.status === 401 || inactive) {
        removeAuthToken();
        removeStoredUser();
        navigate(ROUTES.LOGIN, { replace: true });
        return true;
      }
      return false;
    },
    [navigate],
  );
}
