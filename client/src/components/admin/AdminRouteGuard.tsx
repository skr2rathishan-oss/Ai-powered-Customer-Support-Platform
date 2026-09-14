import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ROUTES } from "../../router/routes";
import { apiRequest, getStoredUser, setStoredUser } from "../../services/apiClient";

interface UserProfile {
  userId: string | number;
  email: string;
  roleName?: string;
  accountType: string;
  firstName?: string;
  lastName?: string;
}

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const navigate = useNavigate();
  const initialUser = getStoredUser<UserProfile>();
  const initialRole = (initialUser?.roleName || "").toLowerCase().trim();
  const initialIsAdmin = Boolean(
    initialUser && (initialRole === "platform admin" || initialRole.includes("platform")),
  );

  const [checking, setChecking] = useState(!initialIsAdmin);
  const [isAuthorized, setIsAuthorized] = useState(initialIsAdmin);
  const [user, setUser] = useState<UserProfile | null>(initialUser);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const response = await apiRequest<{
          success: boolean;
          data: { user: UserProfile };
        }>("/api/auth/me");

        const profile: UserProfile = response?.data?.user;

        if (active) {
          const role = (profile?.roleName || "").toLowerCase().trim();
          if (profile && (role === "platform admin" || role.includes("platform"))) {
            setUser(profile);
            setStoredUser(profile);
            setIsAuthorized(true);
          } else {
            setUser(profile || null);
            setIsAuthorized(false);
          }
          setChecking(false);
        }
      } catch (_e) {
        if (active) {
          if (!initialIsAdmin) {
            navigate(ROUTES.LOGIN);
          } else {
            setChecking(false);
          }
        }
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, [navigate, initialIsAdmin]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
          <span className="spinner" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-on-surface mb-1 font-display">
          Verifying Administrator Privileges…
        </h2>
        <p className="text-sm text-outline">
          Connecting to SupportPilot Platform Security.
        </p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-outline-variant shadow-lg flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl">block</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2 font-display">
            Access Restricted
          </h2>
          <p className="text-sm text-outline leading-relaxed mb-6">
            You are signed in as{" "}
            <strong className="text-on-surface">{user?.email}</strong> (Role:{" "}
            {user?.roleName || user?.accountType}), which does not possess Platform Administrator permissions.
          </p>
          <div className="flex flex-col gap-3 w-full">
            <Link
              to={ROUTES.LOGIN}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all text-center no-underline shadow-sm"
            >
              Sign In as Platform Admin
            </Link>
            <Link
              to={ROUTES.HOME}
              className="w-full py-2.5 rounded-xl border border-outline-variant text-outline font-semibold text-xs hover:bg-surface-container-low transition-all text-center no-underline"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

