import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAgentAuthError } from "../../components/agent/useAgentAuthError";
import { useAgentPortal } from "../../components/agent/useAgentPortal";
import { OverviewStatCard } from "../../components/company/OverviewStatCard";
import { DashboardHero } from "../../components/dashboard/DashboardHero";
import {
  DashboardCard,
  DashboardError,
  DashboardSkeleton,
} from "../../components/dashboard/DashboardCard";
import { StatusBreakdown } from "../../components/dashboard/StatusBreakdown";
import { TicketList, type TicketListItem } from "../../components/dashboard/TicketList";
import {
  greet,
  heroPrimaryAction,
  heroSecondaryAction,
  timeAgo,
} from "../../components/dashboard/dashboardFormat";
import { ROUTES, agentTicketPath } from "../../router/routes";
import { listAgentTickets } from "../../services/agentPortal";
import type { AgentSummary, AgentTicketRow } from "../../types/agentPortal";

function toListItem(ticket: AgentTicketRow): TicketListItem {
  const requester = ticket.requesterName || ticket.requesterEmail || "Unknown requester";
  const lastActivity =
    ticket.lastReplyAt && ticket.lastReplyRole
      ? `last reply from ${ticket.lastReplyRole.toLowerCase()} ${timeAgo(ticket.lastReplyAt)}`
      : `opened ${timeAgo(ticket.createdAt)}`;
  return {
    ticketId: ticket.ticketId,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    meta: `${requester} · ${lastActivity}`,
    to: agentTicketPath(ticket.ticketId),
  };
}

export function AgentDashboardPage() {
  const { data } = useAgentPortal();
  const { agent, company } = data;
  const handleAuthError = useAgentAuthError();

  const [summary, setSummary] = useState<AgentSummary>(data.summary);
  const [waiting, setWaiting] = useState<AgentTicketRow[]>([]);
  const [inProgress, setInProgress] = useState<AgentTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [openResult, progressResult] = await Promise.all([
        listAgentTickets({ status: "Open", sort: "priority", page: 1, limit: 5 }),
        listAgentTickets({ status: "In Progress", sort: "priority", page: 1, limit: 5 }),
      ]);
      setSummary(openResult.summary);
      setWaiting(openResult.tickets);
      setInProgress(progressResult.tickets);
    } catch (err) {
      if (handleAuthError(err)) return;
      setError("Could not load your tickets. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeWork = summary.open + summary.inProgress;
  const urgentWaiting = waiting.filter((t) => t.priority === "Urgent" || t.priority === "High").length;

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow={`${company.companyName} · Support agent`}
        title={greet(agent.firstName)}
        subtitle={
          activeWork > 0
            ? `You have ${activeWork} active ticket${activeWork === 1 ? "" : "s"} assigned to you.`
            : "Your queue is clear. Nice work!"
        }
      >
        <Link to={ROUTES.AGENT_TICKETS} className={heroPrimaryAction}>
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            inbox
          </span>
          Open my queue
        </Link>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={loading}
          className={heroSecondaryAction}
        >
          <span className={`material-symbols-outlined text-lg ${loading ? "animate-spin" : ""}`} aria-hidden="true">
            refresh
          </span>
          Refresh
        </button>
      </DashboardHero>

      {error ? <DashboardError message={error} onRetry={() => void loadDashboard()} /> : null}

      {loading && waiting.length === 0 && inProgress.length === 0 && !error ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section aria-label="My workload" className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <OverviewStatCard
              label="Waiting to start"
              value={summary.open}
              icon="mark_email_unread"
              hint={urgentWaiting > 0 ? `${urgentWaiting} high priority or urgent` : undefined}
            />
            <OverviewStatCard label="In progress" value={summary.inProgress} icon="pending_actions" />
            <OverviewStatCard label="Resolved" value={summary.resolved} icon="task_alt" />
            <OverviewStatCard label="Total assigned" value={summary.total} icon="assignment_ind" />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <DashboardCard
                title="Waiting to start"
                icon="priority_high"
                action={{ label: "View queue", to: `${ROUTES.AGENT_TICKETS}?status=Open` }}
              >
                <TicketList
                  emptyText="No open tickets waiting for you."
                  items={waiting.map(toListItem)}
                />
              </DashboardCard>
              <DashboardCard
                title="In progress"
                icon="pending_actions"
                action={{ label: "View all", to: `${ROUTES.AGENT_TICKETS}?status=In%20Progress` }}
              >
                <TicketList
                  emptyText="Nothing in progress. Pick up a ticket from your queue."
                  items={inProgress.map(toListItem)}
                />
              </DashboardCard>
            </div>

            <div className="space-y-6">
              <DashboardCard title="My tickets" icon="donut_large">
                <StatusBreakdown counts={summary} />
              </DashboardCard>
              <DashboardCard title="Working tips" icon="lightbulb">
                <ul className="space-y-3 text-xs text-[#474555]">
                  <li className="flex gap-2.5">
                    <span className="material-symbols-outlined text-base text-[#6D5EF5]" aria-hidden="true">
                      sort
                    </span>
                    Lists are sorted by priority, so urgent tickets always come first.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="material-symbols-outlined text-base text-[#6D5EF5]" aria-hidden="true">
                      lock
                    </span>
                    Use internal notes for context only your team should see.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="material-symbols-outlined text-base text-[#6D5EF5]" aria-hidden="true">
                      task_alt
                    </span>
                    Mark tickets Resolved once the customer's issue is fixed.
                  </li>
                </ul>
              </DashboardCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
