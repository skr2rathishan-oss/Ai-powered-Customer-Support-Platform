import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { OverviewStatCard } from "../../components/company/OverviewStatCard";
import { useCompanyPortal } from "../../components/company/useCompanyPortal";
import { useTicketAuthError } from "../../components/company/tickets/useTicketAuthError";
import { DashboardHero } from "../../components/dashboard/DashboardHero";
import {
  DashboardCard,
  DashboardEmpty,
  DashboardError,
  DashboardSkeleton,
} from "../../components/dashboard/DashboardCard";
import { StatusBreakdown } from "../../components/dashboard/StatusBreakdown";
import { TicketList } from "../../components/dashboard/TicketList";
import { WeeklyActivityChart } from "../../components/dashboard/WeeklyActivityChart";
import {
  greet,
  heroPrimaryAction,
  heroSecondaryAction,
  timeAgo,
} from "../../components/dashboard/dashboardFormat";
import { ROUTES, companyTicketPath } from "../../router/routes";
import { getTicketStats, listTickets } from "../../services/tickets";
import { TICKET_PRIORITIES, type Ticket, type TicketStats } from "../../types/tickets";

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: "bg-rose-500",
  High: "bg-orange-400",
  Medium: "bg-sky-500",
  Low: "bg-slate-400",
};

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
  const handleAuthError = useTicketAuthError();
  const statusActive = company.status.toLowerCase() === "active";

  const [stats, setStats] = useState<TicketStats | null>(null);
  const [recent, setRecent] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketStats, latest] = await Promise.all([
        getTicketStats(),
        listTickets({ page: 1, limit: 5 }),
      ]);
      setStats(ticketStats);
      setRecent(latest.tickets);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError("Could not load ticket analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  function handleRefresh() {
    void refresh();
    void loadDashboard();
  }

  const steps: { label: string; done: boolean; to: string }[] = [
    { label: "Set up your company profile", done: true, to: ROUTES.DASHBOARD_COMPANY },
    { label: "Invite your support agents", done: overview.supportAgents > 0, to: ROUTES.COMPANY_AGENTS },
    { label: "Publish FAQ articles", done: overview.faqArticles > 0, to: ROUTES.COMPANY_FAQS },
    { label: "Configure the AI assistant", done: overview.aiConfigured, to: ROUTES.COMPANY_AI_SETTINGS },
  ];
  const stepsDone = steps.filter((step) => step.done).length;
  const openWork = stats ? stats.byStatus.open + stats.byStatus.inProgress : 0;
  const maxWorkload = Math.max(1, ...(stats?.agentWorkload.map((a) => a.openTickets) ?? [0]));

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Company workspace"
        title={greet(user.firstName)}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {company.companyName}
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                statusActive ? "bg-emerald-400/25 text-white" : "bg-amber-300/30 text-white"
              }`}
            >
              {company.status}
            </span>
          </span>
        }
      >
        <Link to={ROUTES.COMPANY_TICKETS} className={heroPrimaryAction}>
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            confirmation_number
          </span>
          Manage tickets
        </Link>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className={heroSecondaryAction}
        >
          <span
            className={`material-symbols-outlined text-lg ${refreshing || loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          >
            refresh
          </span>
          Refresh
        </button>
      </DashboardHero>

      {refreshError ? <DashboardError message={refreshError} onRetry={() => void refresh()} /> : null}
      {error ? <DashboardError message={error} onRetry={() => void loadDashboard()} /> : null}

      {loading && !stats ? (
        <DashboardSkeleton />
      ) : stats ? (
        <>
          <section aria-label="Key metrics" className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <OverviewStatCard label="Open tickets" value={stats.byStatus.open} icon="mark_email_unread" />
            <OverviewStatCard label="In progress" value={stats.byStatus.inProgress} icon="pending_actions" />
            <OverviewStatCard
              label="Unassigned"
              value={stats.unassigned}
              icon="person_off"
              hint={stats.unassigned > 0 ? "Waiting for an agent" : "Every ticket has an owner"}
            />
            <OverviewStatCard label="Resolved today" value={overview.resolvedToday} icon="task_alt" />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <DashboardCard title="Ticket activity" icon="bar_chart" className="lg:col-span-2">
              <WeeklyActivityChart days={stats.createdPerDay} />
            </DashboardCard>
            <DashboardCard title="Status breakdown" icon="donut_large">
              <StatusBreakdown counts={stats.byStatus} />
              <div className="mt-6 pt-5 border-t border-[#e2e4e9]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#787586] mb-3">
                  Open work by priority
                </p>
                <ul className="space-y-2.5">
                  {[...TICKET_PRIORITIES].reverse().map((priority) => {
                    const count = stats.openByPriority[priority];
                    return (
                      <li key={priority} className="flex items-center gap-3 text-xs">
                        <span className="w-14 text-[#474555]">{priority}</span>
                        <span className="flex-1 h-2 rounded-full bg-[#f1eff8] overflow-hidden">
                          <span
                            className={`block h-full rounded-full ${PRIORITY_COLORS[priority]}`}
                            style={{ width: `${openWork > 0 ? (count / openWork) * 100 : 0}%` }}
                          />
                        </span>
                        <span className="w-6 text-right font-bold text-[#1c1b23]">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </DashboardCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <DashboardCard
              title="Recent tickets"
              icon="history"
              action={{ label: "View all", to: ROUTES.COMPANY_TICKETS }}
              className="lg:col-span-2"
            >
              <TicketList
                emptyText="No tickets yet. New customer requests will show up here."
                items={recent.map((ticket) => ({
                  ticketId: ticket.ticketId,
                  subject: ticket.subject,
                  status: ticket.status,
                  priority: ticket.priority,
                  meta: `${ticket.requesterName || ticket.requesterEmail || "Internal ticket"} · ${
                    ticket.assigneeName ? `Assigned to ${ticket.assigneeName}` : "Unassigned"
                  } · ${timeAgo(ticket.createdAt)}`,
                  to: companyTicketPath(ticket.ticketId),
                }))}
              />
            </DashboardCard>

            <DashboardCard
              title="Agent workload"
              icon="support_agent"
              action={{ label: "Manage", to: ROUTES.COMPANY_AGENTS }}
            >
              {stats.agentWorkload.length === 0 ? (
                <DashboardEmpty icon="group_add" text="No active agents yet. Invite your team to start assigning tickets." />
              ) : (
                <ul className="space-y-4">
                  {stats.agentWorkload.map((agent) => (
                    <li key={agent.userId} className="flex items-center gap-3">
                      <span className="relative w-9 h-9 shrink-0 rounded-full bg-[#6D5EF5]/10 text-[#6D5EF5] font-bold text-xs flex items-center justify-center">
                        {agent.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            agent.onlineStatus.toLowerCase() === "online" ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          aria-label={agent.onlineStatus}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#1c1b23] truncate">{agent.name}</span>
                          <span className="text-[#787586] whitespace-nowrap">{agent.openTickets} open</span>
                        </span>
                        <span className="block mt-1.5 h-1.5 rounded-full bg-[#f1eff8] overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-[#6D5EF5]"
                            style={{ width: `${(agent.openTickets / maxWorkload) * 100}%` }}
                          />
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardCard>
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard title="Getting started" icon="checklist">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex-1 h-2 rounded-full bg-[#f1eff8] overflow-hidden">
              <span
                className="block h-full rounded-full bg-emerald-500"
                style={{ width: `${(stepsDone / steps.length) * 100}%` }}
              />
            </span>
            <span className="text-xs font-bold text-[#474555]">
              {stepsDone}/{steps.length} done
            </span>
          </div>
          <ul className="space-y-1">
            {steps.map((step) => (
              <li key={step.label}>
                <Link
                  to={step.to}
                  className="flex items-center gap-3 text-sm px-2 py-2 -mx-2 rounded-xl hover:bg-[#f6f2ff]/70 no-underline"
                >
                  <span
                    className={`material-symbols-outlined text-xl ${step.done ? "text-emerald-500" : "text-[#c9c7d3]"}`}
                    aria-hidden="true"
                  >
                    {step.done ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span className={step.done ? "text-[#787586] line-through" : "text-[#1c1b23] font-medium"}>
                    {step.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-[#e2e4e9] text-xs">
            <div>
              <p className="text-[#787586]">Support agents</p>
              <p className="text-lg font-bold text-[#1c1b23]">{overview.supportAgents}</p>
            </div>
            <div>
              <p className="text-[#787586]">FAQ articles</p>
              <p className="text-lg font-bold text-[#1c1b23]">{overview.faqArticles}</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard title="Company profile" icon="domain">
          <dl className="space-y-3 text-sm">
            {[
              ["Industry", orNotProvided(company.industry)],
              ["Business email", orNotProvided(company.businessEmail)],
              ["Phone", orNotProvided(company.phone)],
              ["Website", orNotProvided(company.website)],
              ["Registered", formatDate(company.registrationDate)],
            ].map(([term, value]) => (
              <div key={term} className="flex flex-col sm:flex-row sm:gap-4">
                <dt className="sm:w-32 shrink-0 text-[#787586] text-xs font-semibold uppercase tracking-wider pt-0.5">
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
          {company.description ? (
            <p className="mt-4 text-xs text-[#787586] italic bg-[#fbfbfe] p-3 rounded-xl border border-[#e2e4e9]/80">
              {company.description}
            </p>
          ) : null}
        </DashboardCard>
      </div>
    </div>
  );
}
