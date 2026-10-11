import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { TicketPriorityBadge } from "../../components/company/tickets/TicketPriorityBadge";
import { TicketStatusBadge } from "../../components/company/tickets/TicketStatusBadge";
import { formatTicketDate } from "../../components/company/tickets/ticketFormat";
import { useCustomerAuthError } from "../../components/customer/useCustomerAuthError";
import { ROUTES } from "../../router/routes";
import { ApiError } from "../../services/apiClient";
import { getCustomerTicket } from "../../services/customer";
import type { CustomerTicket } from "../../types/customer";

type LoadState =
  | { id: string; status: "ready"; ticket: CustomerTicket }
  | { id: string; status: "not-found" }
  | { id: string; status: "error"; message: string };

function NotFound() {
  return (
    <section className="bg-white border border-[#e2e4e9] rounded-2xl p-10 text-center shadow-2xs space-y-3">
      <h1 className="text-xl font-bold text-[#1c1b23]">Ticket not found</h1>
      <p className="text-sm text-[#787586]">
        This ticket does not exist or is not one of your tickets.
      </p>
      <Link
        to={ROUTES.CUSTOMER_TICKETS}
        className="inline-flex px-5 py-2.5 rounded-xl border border-[#e2e4e9] text-sm font-semibold text-[#474555] hover:bg-[#f6f2ff] no-underline"
      >
        Back to my tickets
      </Link>
    </section>
  );
}

export function CustomerTicketDetailPage() {
  const { ticketId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const handleAuthError = useCustomerAuthError();
  const validId = /^[1-9]\d*$/.test(ticketId);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState | null>(null);
  const [toast] = useState<string | null>(
    () => (location.state as { toast?: string } | null)?.toast ?? null,
  );

  useEffect(() => {
    if ((location.state as { toast?: string } | null)?.toast) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const requestId = `${ticketId}|${reloadToken}`;

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;

    getCustomerTicket(ticketId)
      .then((ticket) => {
        if (!cancelled) setState({ id: requestId, status: "ready", ticket });
      })
      .catch((error: unknown) => {
        if (cancelled || handleAuthError(error)) return;
        if (
          error instanceof ApiError &&
          (error.status === 404 || error.status === 400)
        ) {
          setState({ id: requestId, status: "not-found" });
          return;
        }
        setState({
          id: requestId,
          status: "error",
          message:
            error instanceof Error ? error.message : "Could not load this ticket.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [ticketId, validId, requestId, handleAuthError]);

  if (!validId) return <NotFound />;

  if (!state || state.id !== requestId) {
    return (
      <div
        role="status"
        className="bg-white border border-[#e2e4e9] rounded-2xl p-12 flex flex-col items-center gap-3 text-sm text-[#787586]"
      >
        <span className="inline-block w-6 h-6 border-2 border-[#6D5EF5]/30 border-t-[#6D5EF5] rounded-full animate-spin" aria-hidden="true" />
        Loading ticket...
      </div>
    );
  }

  if (state.status === "not-found") return <NotFound />;

  if (state.status === "error") {
    return (
      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-10 text-center space-y-3">
        <p role="alert" className="font-semibold text-rose-800 text-sm">
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => setReloadToken((n) => n + 1)}
          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const { ticket } = state;

  return (
    <div className="space-y-6">
      <Link
        to={ROUTES.CUSTOMER_TICKETS}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#6D5EF5] no-underline hover:underline"
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          arrow_back
        </span>
        Back to my tickets
      </Link>

      {toast ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-semibold px-4 py-3"
        >
          {toast}
        </div>
      ) : null}

      <section className="bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-5">
        <div className="space-y-2">
          <p className="text-xs text-[#787586] font-semibold">Ticket #{ticket.ticketId}</p>
          <h1 className="text-2xl font-bold text-[#1c1b23] leading-tight break-words">
            {ticket.subject}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs font-semibold text-[#787586]">Assigned to</dt>
            <dd className="text-[#1c1b23]">
              {ticket.assigneeName ?? "Waiting for an agent"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[#787586]">Submitted</dt>
            <dd className="text-[#1c1b23]">{formatTicketDate(ticket.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[#787586]">Last updated</dt>
            <dd className="text-[#1c1b23]">{formatTicketDate(ticket.updatedAt)}</dd>
          </div>
          {ticket.resolvedAt ? (
            <div>
              <dt className="text-xs font-semibold text-[#787586]">Resolved</dt>
              <dd className="text-[#1c1b23]">{formatTicketDate(ticket.resolvedAt)}</dd>
            </div>
          ) : null}
        </dl>

        <div>
          <h2 className="text-xs font-semibold text-[#787586] mb-1">Description</h2>
          <p className="text-sm text-[#1c1b23] whitespace-pre-wrap break-words">
            {ticket.description}
          </p>
        </div>

        <p className="rounded-xl bg-[#f6f2ff] text-[#474555] text-xs px-4 py-3">
          Replies are coming soon. For now, our team will update the status of
          this ticket as they work on it.
        </p>
      </section>
    </div>
  );
}
