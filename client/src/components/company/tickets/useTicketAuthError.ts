import { useCallback } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "../../../router/routes";
import {
  ApiError,
  removeAuthToken,
  removeStoredUser,
} from "../../../services/apiClient";
import { useCompanyPortal } from "../useCompanyPortal";

/**
 * Returns a handler for mid-session auth failures. On 401 it clears the stored
 * session and redirects to login; on 403 it re-runs the portal guard. Returns
 * true when the error was an auth failure that was handled.
 */
export function useTicketAuthError(): (error: unknown) => boolean {
  const { refresh } = useCompanyPortal();
  const navigate = useNavigate();

  return useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) return false;
      if (error.status === 401) {
        removeAuthToken();
        removeStoredUser();
        navigate(ROUTES.LOGIN_COMPANY, { replace: true });
        return true;
      }
      if (error.status === 403) {
        void refresh();
        return false;
      }
      return false;
    },
    [navigate, refresh],
  );
}
