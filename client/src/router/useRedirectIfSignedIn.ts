import { useEffect } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "./routes";
import { useSessionHome } from "./useSessionHome";

/**
 * Sends an already signed-in account from a public auth page (login, sign up)
 * to its own workspace. Do not use on pages that must stay reachable while
 * signed in, such as password reset.
 */
export function useRedirectIfSignedIn(): void {
  const navigate = useNavigate();
  const { home } = useSessionHome();

  useEffect(() => {
    if (home && home !== ROUTES.HOME) {
      navigate(home, { replace: true });
    }
  }, [home, navigate]);
}
