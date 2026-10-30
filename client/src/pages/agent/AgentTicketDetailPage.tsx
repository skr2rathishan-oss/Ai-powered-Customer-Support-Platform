import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useAgentAuthError } from "../../components/agent/useAgentAuthError";
import { TicketPriorityBadge } from "../../components/company/tickets/TicketPriorityBadge";
import { TicketStatusBadge } from "../../components/company/tickets/TicketStatusBadge";
import { formatTicketDate } from "../../components/company/tickets/ticketFormat";
import { ReplyForm } from "../../components/tickets/ReplyForm";
import { ReplyThread } from "../../components/tickets/ReplyThread";
import { ROUTES } from "../../router/routes";
import {
  getAgentTicket,
  getErrorCode,
  postAgentReply,
  updateAgentTicketStatus,
} from "../../services/agentPortal";
import { ApiError } from "../../services/apiClient";
import type { AgentTicketDetail, TicketReply } from "../../types/agentPortal";
import type { TicketStatus } from "../../types/tickets";

const SETTABLE: TicketStatus[] = ["Open", "In Progress", "Resolved"];

type LoadState =
  | { id: string; status: "ready"; ticket: AgentTicketDetail; replies: TicketReply[] }
  | { id: string; status: "not-found" }
  | { id: string; status: "error"; message: string };

function NotFound() {
  return (
    <section className="bg-white border border-[#e2e4e9] rounded-2xl p-10 text-center shadow-2xs space-y-3">
      <h1 className="text-xl font-bold text-[#1c1b23]">Ticket not found</h1>
      <p className="text-sm text-[#787586]">
        This ticket does not exist or is not assigned to you.
      </p>
      <Link
        to={ROUTES.AGENT_TICKETS}
        className="inline-flex px-5 py-2.5 rounded-xl border border-[#e2e4e9] text-sm font-semibold text-[#474555] hover:bg-[#f6f2ff] no-underline"
      >
        Back to my queue
      </Link>
    </section>
  );
}

function StatusControl({
  ticket,
  onUpdated,
}: {
  ticket: AgentTicketDetail;
  onUpdated: (ticket: AgentTicketDetail) => void;
}) {
  const handleAuthError = useAgentAuthError();
  const [value, setValue] = useState<TicketStatus>(ticket.status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (ticket.status === "Closed") {
    return (
      <p className="rounded-xl bg-slate-50 border border-[#e2e4e9] text-sm text-[#474555] px-4 py-3">
        Closed. This ticket is closed and can no longer be changed.
      </p>
    );
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await updateAgentTicketStatus(ticket.ticketId, value);
      onUpdated(updated);
      setMessage(`Status updated to ${updated.status}.`);
    } catch (caught) {
      if (handleAuthError(caught)) return;
      setError(
        caught instanceof Error ? caught.message : "Could not update the status.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="agent-ticket-status" className="block text-xs font-semibold text-[#474555] mb-1">
            Change status
          </label>
          <select
            id="agent-ticket-status"
            value={value}
            onChange={(event) => setValue(event.target.value as TicketStatus)}
            className="rounded-lg border border-[#e2e4e9] bg-white px-3 py-2 text-sm text-[#1c1b23] focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30"
          >
            {SETTABLE.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || value === ticket.status}
          className="px-4 py-2 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer"
        >
          {saving ? "Saving..." : "Update status"}
        </button>
      </div>
      {message ? (
        <p role="status" className="text-xs font-semibold text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AgentTicketDetailPage() {
  const { ticketId = "" } = useParams();
  const handleAuthError = useAgentAuthError();
  const validId = /^[1-9]\d*$/.test(ticketId);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);

  const requestId = `${ticketId}|${reloadToken}`;

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;

    getAgentTicket(ticketId)
      .then((result) => {
        if (!cancelled) setState({ id: requestId, status: "ready", ...result });
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
          message: error instanceof Error ? error.message : "Could not load this ticket.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [ticketId, validId, requestId, handleAuthError]);

  const backLink = (
    <Link
      to={ROUTES.AGENT_TICKETS}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[#6D5EF5] no-underline hover:underline"
    >
      <span className="material-symbols-outlined text-base" aria-hidden="true">
        arrow_back
      </span>
      Back to my queue
    </Link>
  );

  if (!validId) return <NotFound />;

  if (!state || state.id !== requestId) {
    return (
      <div className="space-y-4">
        {backLink}
        <div
          role="status"
          className="bg-white border border-[#e2e4e9] rounded-2xl p-12 flex flex-col items-center gap-3 text-sm text-[#787586]"
        >
          <span className="inline-block w-6 h-6 border-2 border-[#6D5EF5]/30 border-t-[#6D5EF5] rounded-full animate-spin" aria-hidden="true" />
          Loading ticket...
        </div>
      </div>
    );
  }

  if (state.status === "not-found") return <NotFound />;

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        {backLink}
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
      </div>
    );
  }

  const { ticket, replies } = state;
  const closed = ticket.status === "Closed";

  async function sendReply(body: string, isInternal: boolean) {
    try {
      const reply = await postAgentReply(ticket.ticketId, { body, isInternal });
      setState((current) =>
        current && current.status === "ready" && current.id === requestId
          ? { ...current, replies: [...current.replies, reply] }
          : current,
      );
      window.setTimeout(
        () => threadEnd.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }),
        0,
      );
    } catch (error) {
      if (handleAuthError(error)) return;
      if (getErrorCode(error) === "TICKET_NOT_FOUND") {
        setState({ id: requestId, status: "not-found" });
        return;
      }
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      {backLink}

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

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs font-semibold text-[#787586]">Requester</dt>
            <dd className="text-[#1c1b23] break-words">
              {ticket.requesterName || "Unknown requester"}
              {ticket.requesterEmail ? (
                <span className="block text-xs text-[#787586]">{ticket.requesterEmail}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[#787586]">Created</dt>
            <dd className="text-[#1c1b23]">{formatTicketDate(ticket.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[#787586]">Last updated</dt>
            <dd className="text-[#1c1b23]">{formatTicketDate(ticket.updatedAt)}</dd>
          </div>
        </dl>

        <StatusControl
          key={ticket.ticketId}
          ticket={ticket}
          onUpdated={(updated) =>
            setState((current) =>
              current && current.status === "ready"
                ? { ...current, ticket: updated }
                : current,
            )
          }
        />
      </section>

      <section className="bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-4">
        <h2 className="text-lg font-bold text-[#1c1b23]">Conversation</h2>
        <ReplyThread
          replies={replies}
          opening={{
            authorName: ticket.requesterName,
            body: ticket.description,
            createdAt: ticket.createdAt,
          }}
        />
        <div ref={threadEnd} />
        <ReplyForm
          allowInternal
          idPrefix="agent-reply"
          onSubmit={sendReply}
          disabledReason={
            closed ? "This ticket is closed. Replies are no longer possible." : null
          }
        />
      </section>
    </div>
  );
}
