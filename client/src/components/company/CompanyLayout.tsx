import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { ROUTES } from "../../router/routes";
import { logout } from "../../services/auth";
import { useCompanyPortal } from "./useCompanyPortal";

interface NavItem {
  label: string;
  to: string;
  icon: string;
  feature?: "tickets" | "agents" | "faqs" | "aiSettings";
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", to: ROUTES.DASHBOARD_COMPANY, icon: "dashboard" },
  { label: "Tickets", to: ROUTES.COMPANY_TICKETS, icon: "confirmation_number", feature: "tickets" },
  { label: "Agents", to: ROUTES.COMPANY_AGENTS, icon: "support_agent", feature: "agents" },
  { label: "FAQs", to: ROUTES.COMPANY_FAQS, icon: "quiz", feature: "faqs" },
  { label: "AI Settings", to: ROUTES.COMPANY_AI_SETTINGS, icon: "smart_toy", feature: "aiSettings" },
];

export function CompanyLayout() {
  const portal = useCompanyPortal();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, company, overview } = portal.data;

  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() ||
    user.email[0]?.toUpperCase() ||
    "?";
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  async function handleSignOut() {
    try {
      await logout();
    } finally {
      navigate(ROUTES.LOGIN_COMPANY);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-[#1c1b23] font-sans antialiased overflow-x-hidden">
      {menuOpen ? (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 h-screen w-72 bg-white border-r border-[#e2e4e9] flex flex-col py-8 z-50 shadow-xs transition-transform lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Company navigation"
      >
        <div className="px-8 mb-8 flex items-center gap-3.5">
          <div className="w-11 h-11 bg-[#6D5EF5] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#6D5EF5]/20">
            <span
              className="material-symbols-outlined text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              rocket_launch
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg text-[#1c1b23] tracking-tight leading-none">
              SupportPilot
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-[#787586] font-semibold mt-1 truncate">
              {company.companyName}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            const soon = item.feature ? !overview.features[item.feature] : false;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-3 p-3.5 rounded-xl transition-all group overflow-hidden no-underline ${
                  active
                    ? "text-[#6D5EF5] font-semibold bg-[#6D5EF5]/8"
                    : "text-[#474555] hover:bg-[#f6f2ff] hover:text-[#1c1b23]"
                }`}
              >
                {active ? (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#6D5EF5] rounded-r-full" />
                ) : null}
                <span
                  className={`material-symbols-outlined text-xl ${
                    active ? "text-[#6D5EF5]" : "text-[#787586] group-hover:text-[#6D5EF5]"
                  }`}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="text-sm flex-1">{item.label}</span>
                {soon ? (
                  <span className="px-2 py-0.5 rounded-md bg-[#f6f2ff] text-[#787586] text-[9px] font-bold uppercase tracking-wide">
                    Soon
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 mt-auto">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              logout
            </span>
            Sign Out
          </button>
        </div>
      </aside>

      <header className="fixed top-0 left-0 lg:left-72 right-0 h-20 z-30 bg-white/90 backdrop-blur-md border-b border-[#e2e4e9] px-4 sm:px-8 flex items-center justify-between shadow-2xs">
        <button
          type="button"
          className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-[#474555] hover:bg-[#f6f2ff] cursor-pointer"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            menu
          </span>
        </button>
        <div className="hidden lg:block" />
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="font-bold text-xs text-[#1c1b23] leading-tight">{displayName}</p>
            <p className="text-[10px] text-[#787586] font-medium uppercase tracking-wider">
              {user.roleName}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#6D5EF5] to-[#9b8eff] flex items-center justify-center text-white font-bold text-xs border border-white shadow-xs">
            {initials}
          </div>
        </div>
      </header>

      <main className="lg:ml-72 pt-28 pb-16 px-4 sm:px-10">
        <div className="max-w-6xl mx-auto">
          <Outlet context={portal} />
        </div>
      </main>
    </div>
  );
}
