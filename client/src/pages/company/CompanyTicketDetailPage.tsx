import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ReplyForm } from "../../components/tickets/ReplyForm";
import { ReplyThread } from "../../components/tickets/ReplyThread";
import { TicketPropertyEditor } from "../../components/company/tickets/TicketPropertyEditor";
import { formatTicketDate } from "../../components/company/tickets/ticketFormat";
import { useCompanyPortal } from "../../components/company/useCompanyPortal";
import { ROUTES } from "../../router/routes";
import {
  ApiError,
  removeAuthToken,
  removeStoredUser,
} from "../../services/apiClient";
import {
  getErrorCode,
  getTicket,
  listAssignableAgents,
  listTicketReplies,
  postTicketReply,
} from "../../services/tickets";
import type { TicketReply } from "../../types/agentPortal";
import type { AssignableAgent, Ticket } from "../../types/tickets";

type LoadState =
  | { id: string; status: "ready"; ticket: Ticket; agents: AssignableAgent[]; agentsFailed: boolean }
  | { id: string; status: "not-found" }
  | { id: string; status: "error"; message: string };

function NotFound() {
  return (
    <section className="bg-white border border-[#e2e4e9] rounded-2xl p-10 text-center shadow-2xs space-y-3">
      <h1 className="text-xl font-bold text-[#1c1b23]">Ticket not found</h1>
      <p className="text-sm text-[#787586]">
        This ticket does not exist or is not part of your company.
      </p>
      <Link
        to={ROUTES.COMPANY_TICKETS}
        className="inline-flex px-5 py-2.5 rounded-xl border border-[#e2e4e9] text-sm font-semibold text-[#474555] hover:bg-[#f6f2ff] no-underline"
      >
        Back to all tickets
      </Link>
    </section>
  );
}

function ConversationSection({
  ticketId,
  closed,
}: {
  ticketId: number;
  closed: boolean;
}) {
  const [replies, setReplies] = useState<TicketReply[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listTicketReplies(ticketId)
      .then((result) => {
        if (cancelled) return;
        setError(null);
        setReplies(result);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : "Could not load the conversation.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId, reloadToken]);

  async function sendReply(body: string, isInternal: boolean) {
    const reply = await postTicketReply(ticketId, { body, isInternal });
    setReplies((current) => [...(current ?? []), reply]);
  }

  return (
    <section className="bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-4">
      <h2 className="text-lg font-bold text-[#1c1b23]">Conversation</h2>
      {error ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm font-semibold text-rose-800">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setReloadToken((n) => n + 1);
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : replies === null ? (
        <p role="status" className="text-sm text-[#787586]">
          Loading conversation...
        </p>
      ) : (
        <ReplyThread replies={replies} emptyText="No replies yet." />
      )}
      <ReplyForm
        allowInternal
        idPrefix="admin-reply"
        onSubmit={sendReply}
        disabledReason={closed ? "This ticket is closed. Replies are no longer possible." : null}
      />
    </section>
  );
}

export function CompanyTicketDetailPage() {
  const { ticketId = "" } = useParams();
  const portal = useCompanyPortal();
  const { refresh } = portal;
  const navigate = useNavigate();
  const location = useLocation();
  const validId = /^[1-9]\d*$/.test(ticketId);
  const requestId = `${ticketId}|`;
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState | null>(null);
  const [ticketOverride, setTicketOverride] = useState<Ticket | null>(null);
  const [toast] = useState<string | null>(
    () => (location.state as { toast?: string } | null)?.toast ?? null,
  );

  useEffect(() => {
    if ((location.state as { toast?: string } | null)?.toast) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    const id = `${requestId}${reloadToken}`;

    Promise.all([
      getTicket(ticketId),
      listAssignableAgents().then(
        (agents) => ({ agents, failed: false }),
        () => ({ agents: [] as AssignableAgent[], failed: true }),
      ),
    ])
      .then(([ticket, agentResult]) => {
        if (cancelled) return;
        setTicketOverride(null);
        setState({
          id,
          status: "ready",
          ticket,
          agents: agentResult.agents,
          agentsFailed: agentResult.failed,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          removeAuthToken();
          removeStoredUser();
          navigate(ROUTES.LOGIN_COMPANY, { replace: true });
          return;
        }
        if (error instanceof ApiError && error.status === 403) {
          void refresh();
        }
        const code = getErrorCode(error);
        if (
          error instanceof ApiError &&
          (error.status === 404 || code === "TICKET_NOT_FOUND" || code === "INVALID_TICKET_ID")
        ) {
          setState({ id, status: "not-found" });
          return;
        }
        setState({
          id,
          status: "error",
          message: error instanceof Error ? error.message : "Could not load this ticket.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [validId, ticketId, requestId, reloadToken, navigate, refresh]);

  const backLink = (
    <Link
      to={ROUTES.COMPANY_TICKETS}
      className="inline-flex items-center gap-1 text-sm font-semibold text-[#6D5EF5] hover:underline no-underline"
    >
      <span className="material-symbols-outlined text-base" aria-hidden="true">
        arrow_back
      </span>
      All tickets
    </Link>
  );

  if (!validId) {
    return (
      <div className="space-y-4">
        {backLink}
        <NotFound />
      </div>
    );
  }

  const current = state && state.id === `${requestId}${reloadToken}` ? state : null;

  if (!current) {
    return (
      <div className="space-y-4">
        {backLink}
        <div
          role="status"
          className="bg-white border border-[#e2e4e9] rounded-2xl p-12 flex flex-col items-center gap-3 text-sm text-[#787586] shadow-2xs"
        >
          <span className="inline-block w-6 h-6 border-2 border-[#6D5EF5]/30 border-t-[#6D5EF5] rounded-full animate-spin" aria-hidden="true" />
          Loading ticket...
        </div>
      </div>
    );
  }

  if (current.status === "not-found") {
    return (
      <div className="space-y-4">
        {backLink}
        <NotFound />
      </div>
    );
  }

  if (current.status === "error") {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="bg-white border border-[#e2e4e9] rounded-2xl p-10 text-center space-y-3 shadow-2xs">
          <p role="alert" className="font-semibold text-rose-800 text-sm">
            {current.message}
          </p>
          <button
            type="button"
            onClick={() => setReloadToken((n) => n + 1)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const ticket = ticketOverride ?? current.ticket;

  return (
    <div className="space-y-4">
      {backLink}
      {toast && !ticketOverride ? (
        <p
          role="status"
          className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800"
        >
          {toast}
        </p>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#787586]">#{ticket.ticketId}</p>
            <h1 className="text-2xl font-bold text-[#1c1b23] break-words">
              {ticket.subject}
            </h1>
            <p className="text-xs text-[#787586] mt-2">
              Created {formatTicketDate(ticket.createdAt)} · Updated{" "}
              {formatTicketDate(ticket.updatedAt)}
            </p>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#787586] mb-2">
              Description
            </h2>
            <p className="text-sm text-[#1c1b23] whitespace-pre-wrap break-words">
              {ticket.description}
            </p>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#787586] mb-2">
              Requester
            </h2>
            {ticket.requesterName || ticket.requesterEmail ? (
              <div className="text-sm text-[#1c1b23] space-y-0.5">
                {ticket.requesterName ? <p>{ticket.requesterName}</p> : null}
                {ticket.requesterEmail ? (
                  <a
                    href={`mailto:${ticket.requesterEmail}`}
                    className="text-[#6D5EF5] hover:underline"
                  >
                    {ticket.requesterEmail}
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[#787586]">No requester details</p>
            )}
          </div>
        </section>

        <aside className="bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-4 self-start">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#787586]">
            Properties
          </h2>
          <TicketPropertyEditor
            ticket={ticket}
            agents={current.agents}
            agentsFailed={current.agentsFailed}
            onUpdated={(updated) => {
              setTicketOverride(updated);
              void refresh();
            }}
          />
          {ticket.resolvedAt ? (
            <p className="text-xs text-[#787586]">
              Resolved at {formatTicketDate(ticket.resolvedAt)}
            </p>
          ) : null}
        </aside>
      </div>

      <ConversationSection
        key={ticket.ticketId}
        ticketId={ticket.ticketId}
        closed={ticket.status === "Closed"}
      />
    </div>
  );
}
