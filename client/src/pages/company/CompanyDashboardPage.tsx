import { Link } from "react-router";
import { OverviewStatCard } from "../../components/company/OverviewStatCard";
import { useCompanyPortal } from "../../components/company/useCompanyPortal";
import { ROUTES } from "../../router/routes";

function orNotProvided(value: string | null | undefined): string {
  return value && value.trim() ? value : "Not provided";
}

function formatDate(value: string | null): string {
  if (!value) return "Not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not provided"
    : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function CompanyDashboardPage() {
  const { data, refresh, refreshing, refreshError } = useCompanyPortal();
  const { user, company, overview } = data;
  const statusActive = company.status.toLowerCase() === "active";

  const steps = [
    { label: "Set up your company profile", done: true },
    { label: "Invite your support agents", done: overview.supportAgents > 0 },
    { label: "Publish FAQ articles for the AI assistant", done: overview.faqArticles > 0 },
    { label: "Configure AI settings", done: false },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1c1b23] tracking-tight">
            Welcome back, {user.firstName || "there"}
          </h2>
          <p className="text-sm text-[#787586] mt-1 flex items-center gap-2">
            {company.companyName}
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                statusActive ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              }`}
            >
              {company.status}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e2e4e9] bg-white text-sm font-semibold text-[#474555] hover:bg-[#f6f2ff] disabled:opacity-60 cursor-pointer"
        >
          <span
            className={`material-symbols-outlined text-base ${refreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          >
            refresh
          </span>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {refreshError ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-3"
        >
          {refreshError}
        </div>
      ) : null}

      <section aria-label="Overview statistics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        <OverviewStatCard label="Open tickets" value={overview.openTickets} icon="confirmation_number" />
        <OverviewStatCard label="Resolved today" value={overview.resolvedToday} icon="task_alt" />
        <OverviewStatCard label="Support agents" value={overview.supportAgents} icon="support_agent" />
        <OverviewStatCard label="FAQ articles" value={overview.faqArticles} icon="quiz" />
        <OverviewStatCard
          label="AI resolution rate"
          value={overview.aiResolutionRate === null ? null : `${overview.aiResolutionRate}%`}
          icon="smart_toy"
        />
        <OverviewStatCard
          label="Avg. first response"
          value={
            overview.avgFirstResponseMinutes === null
              ? null
              : `${overview.avgFirstResponseMinutes} min`
          }
          icon="schedule"
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs">
          <h3 className="font-bold text-sm text-[#1c1b23] mb-4">Company profile</h3>
          <dl className="space-y-3 text-sm">
            {[
              ["Company", company.companyName],
              ["Industry", orNotProvided(company.industry)],
              ["Business email", orNotProvided(company.businessEmail)],
              ["Phone", orNotProvided(company.phone)],
              ["Website", orNotProvided(company.website)],
              ["Description", orNotProvided(company.description)],
              ["Registered", formatDate(company.registrationDate)],
            ].map(([term, value]) => (
              <div key={term} className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="sm:w-36 shrink-0 text-[#787586] text-xs font-semibold uppercase tracking-wider pt-0.5">
                  {term}
                </dt>
                <dd
                  className={`break-words min-w-0 ${
                    value === "Not provided" ? "text-[#787586] italic" : "text-[#1c1b23]"
                  }`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs">
          <h3 className="font-bold text-sm text-[#1c1b23] mb-4">Getting started</h3>
          <ul className="space-y-3">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-3 text-sm">
                <span
                  className={`material-symbols-outlined text-xl ${
                    step.done ? "text-emerald-500" : "text-[#c9c7d3]"
                  }`}
                  aria-hidden="true"
                >
                  {step.done ? "check_circle" : "radio_button_unchecked"}
                </span>
                <span className={step.done ? "text-[#787586] line-through" : "text-[#1c1b23]"}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#787586] mt-5">
            Ticketing, agents, FAQs and AI settings are{" "}
            <Link to={ROUTES.COMPANY_TICKETS} className="text-[#6D5EF5] font-semibold">
              rolling out soon
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
