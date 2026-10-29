import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { OverviewStatCard } from "../../components/company/OverviewStatCard";
import { useCustomerAuthError } from "../../components/customer/useCustomerAuthError";
import { useCustomerPortal } from "../../components/customer/useCustomerPortal";
import { DashboardHero } from "../../components/dashboard/DashboardHero";
import {
  DashboardCard,
  DashboardEmpty,
  DashboardError,
  DashboardSkeleton,
} from "../../components/dashboard/DashboardCard";
import { TicketList } from "../../components/dashboard/TicketList";
import {
  greet,
  heroPrimaryAction,
  heroSecondaryAction,
  timeAgo,
} from "../../components/dashboard/dashboardFormat";
import { ROUTES, customerTicketPath } from "../../router/routes";
import { listCustomerFaqs, listCustomerTickets } from "../../services/customer";
import type { CustomerTicket, PublicFaq } from "../../types/customer";

interface CustomerCounts {
  open: number;
  inProgress: number;
  resolved: number;
  total: number;
}

export function CustomerDashboardPage() {
  const { data } = useCustomerPortal();
  const { customer, company, assistant } = data;
  const handleAuthError = useCustomerAuthError();

  const [counts, setCounts] = useState<CustomerCounts | null>(null);
  const [recent, setRecent] = useState<CustomerTicket[]>([]);
  const [faqs, setFaqs] = useState<PublicFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Status counts come from each filtered list's total, so only one row is fetched each
      const [latest, open, inProgress, resolved, faqResult] = await Promise.all([
        listCustomerTickets({ page: 1, limit: 5 }),
        listCustomerTickets({ status: "Open", page: 1, limit: 1 }),
        listCustomerTickets({ status: "In Progress", page: 1, limit: 1 }),
        listCustomerTickets({ status: "Resolved", page: 1, limit: 1 }),
        listCustomerFaqs().catch(() => ({ faqs: [], categories: [] })),
      ]);
      setRecent(latest.tickets);
      setCounts({
        open: open.pagination.total,
        inProgress: inProgress.pagination.total,
        resolved: resolved.pagination.total,
        total: latest.pagination.total,
      });
      setFaqs(faqResult.faqs.slice(0, 4));
    } catch (err) {
      if (handleAuthError(err)) return;
      setError("Could not load your support overview. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeTickets = counts ? counts.open + counts.inProgress : 0;

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow={`${company.companyName} support`}
        title={`${greet(customer.firstName)}. How can we help?`}
        subtitle={
          counts && activeTickets > 0
            ? `You have ${activeTickets} active request${activeTickets === 1 ? "" : "s"} with our team.`
            : "Browse answers in the help center or open a ticket and our team will get back to you."
        }
      >
        {assistant.enabled ? (
          <Link to={ROUTES.CUSTOMER_CHAT} className={heroPrimaryAction}>
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              smart_toy
            </span>
            Chat with {assistant.assistantName}
          </Link>
        ) : null}
        <Link
          to={ROUTES.CUSTOMER_NEW_TICKET}
          className={assistant.enabled ? heroSecondaryAction : heroPrimaryAction}
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            add_circle
          </span>
          New ticket
        </Link>
        <Link to={ROUTES.CUSTOMER_HELP} className={heroSecondaryAction}>
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            quiz
          </span>
          Help center
        </Link>
      </DashboardHero>

      {error ? <DashboardError message={error} onRetry={() => void loadDashboard()} /> : null}

      {loading && !counts ? (
        <DashboardSkeleton />
      ) : counts ? (
        <>
          <section aria-label="My tickets summary" className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <OverviewStatCard label="Open" value={counts.open} icon="mark_email_unread" hint="Waiting for our team" />
            <OverviewStatCard label="In progress" value={counts.inProgress} icon="pending_actions" hint="Being worked on" />
            <OverviewStatCard label="Resolved" value={counts.resolved} icon="task_alt" />
            <OverviewStatCard label="All tickets" value={counts.total} icon="confirmation_number" />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <DashboardCard
              title="My recent tickets"
              icon="history"
              action={{ label: "View all", to: ROUTES.CUSTOMER_TICKETS }}
              className="lg:col-span-2"
            >
              <TicketList
                emptyText="You haven't raised any tickets yet."
                items={recent.map((ticket) => ({
                  ticketId: ticket.ticketId,
                  subject: ticket.subject,
                  status: ticket.status,
                  meta: `${
                    ticket.assigneeName ? `Handled by ${ticket.assigneeName}` : "Waiting for an agent"
                  } · updated ${timeAgo(ticket.updatedAt)}`,
                  to: customerTicketPath(ticket.ticketId),
                }))}
              />
              {recent.length === 0 ? (
                <div className="text-center -mt-2">
                  <Link
                    to={ROUTES.CUSTOMER_NEW_TICKET}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6D5EF5] text-white text-xs font-bold no-underline hover:bg-[#5b4be8]"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      add
                    </span>
                    Raise your first ticket
                  </Link>
                </div>
              ) : null}
            </DashboardCard>

            <div className="space-y-6">
              {assistant.enabled ? (
                <section className="rounded-2xl p-5 border border-[#6D5EF5]/20 bg-[#f6f2ff]">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-9 h-9 rounded-xl bg-[#6D5EF5] text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">
                        smart_toy
                      </span>
                    </span>
                    <p className="font-bold text-sm text-[#1c1b23]">{assistant.assistantName}</p>
                  </div>
                  <p className="text-xs text-[#474555]">
                    {assistant.greeting || "Ask me a question and get an instant answer."}
                  </p>
                  <Link
                    to={ROUTES.CUSTOMER_CHAT}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#6D5EF5] text-white text-xs font-bold no-underline hover:bg-[#5b4be8]"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      chat
                    </span>
                    Start a chat
                  </Link>
                </section>
              ) : null}

              <DashboardCard
                title="Popular answers"
                icon="lightbulb"
                action={{ label: "Help center", to: ROUTES.CUSTOMER_HELP }}
              >
                {faqs.length === 0 ? (
                  <DashboardEmpty icon="menu_book" text="No help articles have been published yet." />
                ) : (
                  <ul className="space-y-1 -mx-2">
                    {faqs.map((faq) => (
                      <li key={faq.faqId}>
                        <Link
                          to={ROUTES.CUSTOMER_HELP}
                          className="flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-[#f6f2ff]/70 no-underline"
                        >
                          <span className="material-symbols-outlined text-base text-[#6D5EF5] mt-0.5" aria-hidden="true">
                            help
                          </span>
                          <span className="text-xs font-medium text-[#1c1b23]">{faq.question}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </DashboardCard>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
