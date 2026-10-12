import { useEffect } from "react";
import { Link } from "react-router";
import { ROUTES } from "../router/routes";
import { useSessionHome } from "../router/useSessionHome";

export function NotFoundPage() {
  const { loading, home } = useSessionHome();
  const signedIn = Boolean(home && home !== ROUTES.HOME);

  useEffect(() => {
    document.title = "Page not found | SupportPilot";
  }, []);

  return (
    <main className="min-h-screen bg-[#f8f9fc] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-outline-variant shadow-lg flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl">explore_off</span>
        </div>
        <h1 className="text-xl font-bold text-on-surface mb-2 font-display">
          Page not found
        </h1>
        <p className="text-sm text-outline leading-relaxed mb-6">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="flex flex-col gap-3 w-full">
          {signedIn && home ? (
            <Link
              to={home}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all text-center no-underline shadow-sm"
            >
              Go to my workspace
            </Link>
          ) : (
            !loading && (
              <>
                <Link
                  to={ROUTES.HOME}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all text-center no-underline shadow-sm"
                >
                  Back to home
                </Link>
                <Link
                  to={ROUTES.LOGIN}
                  className="w-full py-2.5 rounded-xl border border-outline-variant text-outline font-semibold text-xs hover:bg-surface-container-low transition-all text-center no-underline"
                >
                  Sign in
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </main>
  );
}
