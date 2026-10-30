import { useEffect, useState } from "react";
import { apiRequest } from "../services/apiClient";
import { homeForRole } from "./roleRedirect";

interface SessionUser {
  email: string;
  roleName?: string;
  accountType?: string;
}

interface SessionHomeState {
  /** Resolved once the session check finishes. */
  loading: boolean;
  /** Home path for the signed-in account, or null when signed out. */
  home: string | null;
}

/** Looks up the current session via /api/auth/me and maps it to a home path. */
export function useSessionHome(): SessionHomeState {
  const [state, setState] = useState<SessionHomeState>({
    loading: true,
    home: null,
  });

  useEffect(() => {
    let active = true;

    apiRequest<{ data?: { user?: SessionUser } }>("/api/auth/me")
      .then((response) => {
        if (!active) return;
        const user = response?.data?.user;
        setState({
          loading: false,
          home: user ? homeForRole(user.roleName, user.accountType) : null,
        });
      })
      .catch(() => {
        if (active) setState({ loading: false, home: null });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
