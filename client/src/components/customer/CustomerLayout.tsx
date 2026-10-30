import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { ROUTES } from "../../router/routes";
import { logout } from "../../services/auth";
import { useCustomerPortal } from "./useCustomerPortal";

const NAV_ITEMS = [
  { label: "Dashboard", to: ROUTES.CUSTOMER_DASHBOARD, icon: "space_dashboard" },
  { label: "Ask AI", to: ROUTES.CUSTOMER_CHAT, icon: "smart_toy" },
  { label: "My tickets", to: ROUTES.CUSTOMER_TICKETS, icon: "confirmation_number" },
  { label: "New ticket", to: ROUTES.CUSTOMER_NEW_TICKET, icon: "add_circle" },
  { label: "Help center", to: ROUTES.CUSTOMER_HELP, icon: "quiz" },
] as const;

function isActive(pathname: string, to: string): boolean {
  if (to === ROUTES.CUSTOMER_TICKETS) {
    return (
      pathname === to ||
      (pathname.startsWith(`${to}/`) && pathname !== ROUTES.CUSTOMER_NEW_TICKET)
    );
  }
  return pathname === to;
}

export function CustomerLayout() {
  const portal = useCustomerPortal();
  const navigate = useNavigate();
  const location = useLocation();
  const { customer, company } = portal.data;

  const initials =
    `${customer.firstName?.[0] ?? ""}${customer.lastName?.[0] ?? ""}`.toUpperCase() ||
    customer.email[0]?.toUpperCase() ||
    "?";
  const displayName =
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.email;

  async function handleSignOut() {
    try {
      await logout();
    } finally {
      navigate(ROUTES.LOGIN);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-[#1c1b23] font-sans antialiased overflow-x-hidden">
      <header className="bg-white border-b border-[#e2e4e9] shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#6D5EF5] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#6D5EF5]/20 shrink-0">
              <span
                className="material-symbols-outlined text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                rocket_launch
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-base text-[#1c1b23] tracking-tight leading-none">
                SupportPilot
              </p>
              <p className="text-[10px] uppercase tracking-widest text-[#787586] font-semibold mt-1 truncate">
                {company.companyName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="font-bold text-xs text-[#1c1b23] leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] text-[#787586] font-medium uppercase tracking-wider">
                Customer
              </p>
            </div>
            <div
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#6D5EF5] to-[#9b8eff] flex items-center justify-center text-white font-bold text-xs border border-white shadow-xs"
              aria-hidden="true"
            >
              {initials}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                logout
              </span>
              Sign out
            </button>
          </div>
        </div>

        <nav
          aria-label="Support navigation"
          className="max-w-5xl mx-auto px-4 sm:px-8 flex gap-1 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(location.pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 px-3.5 py-3 text-sm whitespace-nowrap border-b-2 no-underline transition-colors ${
                  active
                    ? "border-[#6D5EF5] text-[#6D5EF5] font-semibold"
                    : "border-transparent text-[#474555] hover:text-[#1c1b23] hover:bg-[#f6f2ff]"
                }`}
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="py-8 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <Outlet context={portal} />
        </div>
      </main>
    </div>
  );
}
