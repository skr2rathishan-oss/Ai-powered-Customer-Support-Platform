import { useCallback } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "../../router/routes";
import {
  ApiError,
  removeAuthToken,
  removeStoredUser,
} from "../../services/apiClient";

/**
 * Returns a handler for mid-session auth failures. On 401 it clears the stored
 * session and redirects to login. Returns true when the error was handled.
 */
export function useCustomerAuthError(): (error: unknown) => boolean {
  const navigate = useNavigate();

  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
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
