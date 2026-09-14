import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ROUTES } from "../../router/routes";
import { logout } from "../../services/auth";
import type { PlatformHealthItem, PlatformActivity } from "../../services/admin";

interface AdminLayoutProps {
  children: React.ReactNode;
  healthItems?: PlatformHealthItem[];
  activities?: PlatformActivity[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function AdminLayout({
  children,
  healthItems = [],
  activities = [],
  onRefresh,
  isRefreshing = false,
}: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  async function handleSignOut() {
    try {
      await logout();
    } finally {
      navigate(ROUTES.LOGIN);
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`${ROUTES.ADMIN_COMPANIES}?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  const isDashboard = location.pathname === ROUTES.ADMIN_DASHBOARD;
  const isCompanies = location.pathname.startsWith(ROUTES.ADMIN_COMPANIES);
  const isSettings = location.pathname.startsWith(ROUTES.ADMIN_SETTINGS);

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-[#1c1b23] font-sans antialiased overflow-x-hidden">
      {/* ---------------------------------------------------- */}
      {/* 1. Left Side Navigation Bar (Fixed)                 */}
      {/* ---------------------------------------------------- */}
      <aside className="fixed left-0 top-0 h-screen w-72 bg-white border-r border-[#e2e4e9] flex flex-col py-8 z-50 shadow-xs">
        {/* Brand Logo */}
        <div className="px-8 mb-8 flex items-center gap-3.5">
          <div className="w-11 h-11 bg-[#6D5EF5] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#6D5EF5]/20">
            <span
              className="material-symbols-outlined text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              rocket_launch
            </span>
          </div>
          <div>
            <h1 className="font-bold text-lg text-[#1c1b23] tracking-tight leading-none">
              SupportPilot
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-[#787586] font-semibold mt-1">
              Platform Admin
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          {/* Dashboard Link */}
          <Link
            to={ROUTES.ADMIN_DASHBOARD}
            className={`relative flex items-center gap-3 p-3.5 rounded-xl transition-all group overflow-hidden no-underline ${
              isDashboard
                ? "text-[#6D5EF5] font-semibold bg-[#6D5EF5]/8"
                : "text-[#474555] hover:bg-[#f6f2ff] hover:text-[#1c1b23]"
            }`}
          >
            {isDashboard && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#6D5EF5] rounded-r-full" />
            )}
            <span
              className={`material-symbols-outlined text-xl transition-transform duration-300 group-hover:scale-110 ${
                isDashboard ? "text-[#6D5EF5]" : "text-[#787586] group-hover:text-[#6D5EF5]"
              }`}
            >
              dashboard
            </span>
            <span className="text-sm">Dashboard</span>
          </Link>

          {/* Companies Link */}
          <Link
            to={ROUTES.ADMIN_COMPANIES}
            className={`relative flex items-center gap-3 p-3.5 rounded-xl transition-all group overflow-hidden no-underline ${
              isCompanies
                ? "text-[#6D5EF5] font-semibold bg-[#6D5EF5]/8"
                : "text-[#474555] hover:bg-[#f6f2ff] hover:text-[#1c1b23]"
            }`}
          >
            {isCompanies && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#6D5EF5] rounded-r-full" />
            )}
            <span
              className={`material-symbols-outlined text-xl transition-transform duration-300 group-hover:scale-110 ${
                isCompanies ? "text-[#6D5EF5]" : "text-[#787586] group-hover:text-[#6D5EF5]"
              }`}
            >
              business
            </span>
            <span className="text-sm">Companies</span>
          </Link>

          {/* Settings Link */}
          <Link
            to={ROUTES.ADMIN_SETTINGS}
            className={`relative flex items-center gap-3 p-3.5 rounded-xl transition-all group overflow-hidden no-underline ${
              isSettings
                ? "text-[#6D5EF5] font-semibold bg-[#6D5EF5]/8"
                : "text-[#474555] hover:bg-[#f6f2ff] hover:text-[#1c1b23]"
            }`}
          >
            {isSettings && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#6D5EF5] rounded-r-full" />
            )}
            <span
              className={`material-symbols-outlined text-xl transition-transform duration-300 group-hover:scale-110 ${
                isSettings ? "text-[#6D5EF5]" : "text-[#787586] group-hover:text-[#6D5EF5]"
              }`}
            >
              settings
            </span>
            <span className="text-sm">Settings</span>
          </Link>
        </nav>

        {/* Operational Status Box */}
        <div className="px-6 mt-auto">
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col gap-1.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Operational
            </div>
            <p className="text-[11px] text-emerald-600/90 leading-snug">
              Systems are performing optimally across all regions.
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between text-[#787586] px-2">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs">info</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase">
                SupportPilot v1.0
              </span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-[#6D5EF5]/40" />
          </div>
        </div>
      </aside>

      {/* ---------------------------------------------------- */}
      {/* 2. Top Navigation Bar (Fixed - Spans to Right Edge)  */}
      {/* ---------------------------------------------------- */}
      <header className="fixed top-0 left-72 right-0 h-20 z-40 bg-white/90 backdrop-blur-md border-b border-[#e2e4e9] px-8 flex items-center justify-between shadow-2xs">
        {/* Search Bar */}
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#787586] text-xl">
            search
          </span>
          <input
            className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-full py-2 pl-11 pr-4 text-xs text-[#1c1b23] focus:ring-3 focus:ring-[#6D5EF5]/20 focus:border-[#6D5EF5] outline-none transition-all placeholder-[#787586]"
            placeholder="Search companies, administrators, tickets... (Press Enter)"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#474555] hover:bg-[#f6f2ff] transition-all relative cursor-pointer"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">
              notifications
            </span>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 border-2 border-white rounded-full" />
          </button>

          <div className="w-px h-5 bg-[#e2e4e9]" />

          {/* User Profile Pill */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-3 px-2 py-1 rounded-full hover:bg-[#f6f2ff] transition-all cursor-pointer text-left"
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <div className="text-right hidden sm:block">
                <p className="font-bold text-xs text-[#1c1b23] leading-tight">
                  Admin Panel
                </p>
                <p className="text-[10px] text-[#787586] font-medium uppercase tracking-wider">
                  Super User
                </p>
              </div>
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#6D5EF5] to-[#9b8eff] flex items-center justify-center text-white font-bold text-xs border border-white shadow-xs">
                  SA
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 top-12 w-48 bg-white border border-[#e2e4e9] rounded-xl shadow-lg p-2 z-50">
                <div className="px-3 py-2 border-b border-[#e2e4e9]">
                  <p className="text-xs font-bold text-[#1c1b23]">Platform Admin</p>
                  <p className="text-[10px] text-[#787586]">admin@supportpilot.com</p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full mt-1.5 flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-left cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">
                    logout
                  </span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* 3. Right Sidebar (Platform Health & Activity)        */}
      {/* ---------------------------------------------------- */}
      <aside className="fixed right-0 top-20 h-[calc(100vh-5rem)] w-72 bg-white border-l border-[#e2e4e9] pt-6 pb-8 px-6 z-30 overflow-y-auto">
        {/* Platform Health Card */}
        <div className="bg-white border border-[#e2e4e9] p-5 rounded-2xl mb-8 shadow-2xs">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#6D5EF5]/10 flex items-center justify-center text-[#6D5EF5]">
              <span
                className="material-symbols-outlined text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                shield_lock
              </span>
            </div>
            <div>
              <h3 className="font-bold text-xs text-[#1c1b23] leading-tight">
                Platform Health
              </h3>
              <p className="text-[9px] uppercase tracking-wider text-[#787586] font-semibold">
                Infrastructure
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {healthItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between group cursor-default"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <span className="text-xs font-medium text-[#474555]">
                    {item.name}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[9px] font-bold tracking-wide">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-6 px-1">
            <h3 className="font-bold text-xs text-[#1c1b23]">Activity</h3>
            <button
              type="button"
              onClick={onRefresh}
              className="w-7 h-7 rounded-lg hover:bg-[#f6f2ff] transition-colors flex items-center justify-center text-[#787586] hover:text-[#6D5EF5]"
              title="Refresh Activity"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              >
                refresh
              </span>
            </button>
          </div>

          <div className="flex-1 space-y-6 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e2e4e9]/60">
            {activities.length === 0 ? (
              <p className="text-xs text-[#787586] pl-8">No recent activities.</p>
            ) : (
              activities.slice(0, 4).map((act, index) => (
                <div key={act.id || index} className="relative pl-9 group cursor-default">
                  <div
                    className={`absolute left-0 top-0.5 w-7 h-7 rounded-full flex items-center justify-center z-10 shadow-xs border-2 border-white transition-transform group-hover:scale-110 ${
                      index === 0
                        ? "bg-[#6D5EF5] text-white"
                        : index === 1
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {index === 0
                        ? "domain_add"
                        : index === 1
                        ? "verified"
                        : "notifications"}
                    </span>
                  </div>
                  <div className="p-1 rounded-xl group-hover:bg-[#f6f2ff] transition-all">
                    <p className="text-xs font-bold text-[#1c1b23] leading-tight">
                      {act.title}
                    </p>
                    <p className="text-[11px] text-[#474555] mt-0.5">
                      {act.message}
                    </p>
                    <p className="text-[10px] text-[#787586] mt-1 font-medium">
                      {new Date(act.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            className="mt-8 w-full py-2.5 rounded-xl bg-[#f6f2ff] border border-[#e2e4e9] text-[10px] font-bold uppercase tracking-wider text-[#474555] hover:bg-[#6D5EF5] hover:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            View All Activities
          </button>
        </div>
      </aside>

      {/* ---------------------------------------------------- */}
      {/* 4. Main Canvas                                       */}
      {/* ---------------------------------------------------- */}
      <main className="ml-72 mr-72 pt-28 pb-16 px-10">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>

      {/* Floating Action Button */}
      <button
        type="button"
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#1c1b23] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group border border-white/10 cursor-pointer"
        title="Quick Platform Action"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform">
          bolt
        </span>
      </button>
    </div>
  );
}
