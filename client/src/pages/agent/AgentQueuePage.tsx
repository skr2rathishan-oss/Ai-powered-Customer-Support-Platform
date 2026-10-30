import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAgentAuthError } from "../../components/agent/useAgentAuthError";
import { TicketPriorityBadge } from "../../components/company/tickets/TicketPriorityBadge";
import { TicketStatusBadge } from "../../components/company/tickets/TicketStatusBadge";
import { TicketsPagination } from "../../components/company/tickets/TicketsPagination";
import {
  PAGE_SIZE,
  formatTicketDate,
} from "../../components/company/tickets/ticketFormat";
import { agentTicketPath } from "../../router/routes";
import { listAgentTickets } from "../../services/agentPortal";
import type {
  AgentQueueResult,
  AgentSort,
  AgentTicketRow,
} from "../../types/agentPortal";
import { TICKET_STATUSES, type TicketStatus } from "../../types/tickets";

const SORTS: { value: AgentSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "priority", label: "Priority" },
];

interface Outcome {
  key: string;
  data?: AgentQueueResult;
  error?: string;
}

function parseStatus(raw: string | null): TicketStatus | undefined {
  return raw && (TICKET_STATUSES as readonly string[]).includes(raw)
    ? (raw as TicketStatus)
    : undefined;
}

function parseSort(raw: string | null): AgentSort {
  return SORTS.some((s) => s.value === raw) ? (raw as AgentSort) : "newest";
}

function parsePage(raw: string | null): number {
  return raw && /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : 1;
}

function isAwaiting(ticket: AgentTicketRow): boolean {
  return (
    (ticket.status === "Open" || ticket.status === "In Progress") &&
    ticket.lastReplyRole === "Customer"
  );
}

function AwaitingPill() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-bold whitespace-nowrap">
      Awaiting reply
    </span>
  );
}

export function AgentQueuePage() {
  const handleAuthError = useAgentAuthError();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = parseStatus(searchParams.get("status"));
  const sort = parseSort(searchParams.get("sort"));
  const page = parsePage(searchParams.get("page"));
  const search = (searchParams.get("search") ?? "").trim().slice(0, 100);

  const [searchInput, setSearchInput] = useState(search);
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${status ?? ""}|${search}|${sort}|${page}|${reloadToken}`;
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // Keep the input in step when the URL changes elsewhere (Clear filters)
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Debounce typing into the URL-synced search param
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === search) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (trimmed) next.set("search", trimmed.slice(0, 100));
      else next.delete("search");
      next.delete("page");
      setSearchParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    listAgentTickets({ status, search, sort, page, limit: PAGE_SIZE })
      .then((data) => {
        if (!cancelled) setOutcome({ key: requestKey, data });
      })
      .catch((error: unknown) => {
        if (cancelled || handleAuthError(error)) return;
        setOutcome({
          key: requestKey,
          error: error instanceof Error ? error.message : "Could not load your queue.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [status, search, sort, page, requestKey, handleAuthError]);

  const loading = outcome?.key !== requestKey;
  const data = outcome?.data;
  const error = !loading ? outcome?.error : undefined;

  const totalPages = data?.pagination.totalPages ?? 0;
  useEffect(() => {
    if (!loading && data && totalPages > 0 && page > totalPages) {
      const next = new URLSearchParams(searchParams);
      if (totalPages > 1) next.set("page", String(totalPages));
      else next.delete("page");
      setSearchParams(next, { replace: true });
    }
  }, [loading, data, totalPages, page, searchParams, setSearchParams]);

  function updateParams(changes: { status?: string; sort?: string; page?: number }) {
    const next = new URLSearchParams(searchParams);
    if ("status" in changes) {
      if (changes.status) next.set("status", changes.status);
      else next.delete("status");
      next.delete("page");
    }
    if ("sort" in changes) {
      if (changes.sort && changes.sort !== "newest") next.set("sort", changes.sort);
      else next.delete("sort");
      next.delete("page");
    }
    if (changes.page !== undefined) {
      if (changes.page > 1) next.set("page", String(changes.page));
      else next.delete("page");
    }
    setSearchParams(next);
  }

  function clearFilters() {
    setSearchInput("");
    setSearchParams(new URLSearchParams());
  }

  const tickets = data?.tickets ?? [];
  const filtered = Boolean(status || search);
  const showEmpty = !loading && !error && data && data.pagination.total === 0;
  const summary = data?.summary;

  const chips: { label: string; value: TicketStatus; count: number | undefined }[] = [
    { label: "Open", value: "Open", count: summary?.open },
    { label: "In progress", value: "In Progress", count: summary?.inProgress },
    { label: "Resolved", value: "Resolved", count: summary?.resolved },
  ];

  const controlClass =
    "rounded-lg border border-[#e2e4e9] bg-white px-3 py-2 text-sm text-[#1c1b23] focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-[#6D5EF5]/10 text-[#6D5EF5] flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">
            inbox
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1c1b23] leading-tight">My queue</h1>
          <p className="text-sm text-[#787586]">
            Tickets your company administrator has assigned to you.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Queue summary">
        {chips.map((chip) => {
          const active = status === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={active}
              onClick={() => updateParams({ status: active ? "" : chip.value })}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                active
                  ? "border-[#6D5EF5] bg-[#f6f2ff] text-[#6D5EF5]"
                  : "border-[#e2e4e9] bg-white text-[#474555] hover:bg-[#f6f2ff]"
              }`}
            >
              {chip.label}
              <span className="ml-2 font-bold text-[#1c1b23]">{chip.count ?? "-"}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-4 shadow-2xs flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]">
          <label htmlFor="agent-search" className="block text-xs font-semibold text-[#474555] mb-1">
            Search
          </label>
          <input
            id="agent-search"
            type="search"
            value={searchInput}
            maxLength={100}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Subject or requester"
            className={`${controlClass} w-full`}
          />
        </div>
        <div>
          <label htmlFor="agent-status" className="block text-xs font-semibold text-[#474555] mb-1">
            Status
          </label>
          <select
            id="agent-status"
            value={status ?? ""}
            onChange={(event) => updateParams({ status: event.target.value })}
            className={controlClass}
          >
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="agent-sort" className="block text-xs font-semibold text-[#474555] mb-1">
            Sort
          </label>
          <select
            id="agent-sort"
            value={sort}
            onChange={(event) => updateParams({ sort: event.target.value })}
            className={controlClass}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {filtered ? (
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-2 rounded-lg border border-[#e2e4e9] text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div
        className="bg-white border border-[#e2e4e9] rounded-2xl shadow-2xs overflow-hidden"
        aria-busy={loading}
      >
        {loading && !data ? (
          <div role="status" className="p-12 flex flex-col items-center gap-3 text-sm text-[#787586]">
            <span className="inline-block w-6 h-6 border-2 border-[#6D5EF5]/30 border-t-[#6D5EF5] rounded-full animate-spin" aria-hidden="true" />
            Loading your queue...
          </div>
        ) : error ? (
          <div className="p-10 text-center space-y-3">
            <span className="material-symbols-outlined text-3xl text-rose-500" aria-hidden="true">
              error
            </span>
            <p role="alert" className="font-semibold text-rose-800 text-sm">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setReloadToken((n) => n + 1)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : showEmpty ? (
          filtered ? (
            <div className="p-12 text-center space-y-3">
              <p className="font-semibold text-sm text-[#1c1b23]">
                No tickets match your filters
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 rounded-xl border border-[#e2e4e9] text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="p-12 text-center space-y-1">
              <p className="font-semibold text-sm text-[#1c1b23]">
                No tickets assigned to you yet
              </p>
              <p className="text-xs text-[#787586]">
                Your company administrator assigns tickets to agents. They will show up here.
              </p>
            </div>
          )
        ) : data ? (
          <div className={loading ? "opacity-60" : undefined}>
            <ul className="divide-y divide-[#e2e4e9]" aria-label="Assigned tickets">
              {tickets.map((ticket) => (
                <li key={ticket.ticketId}>
                  <Link
                    to={agentTicketPath(ticket.ticketId)}
                    className="block px-5 py-4 no-underline hover:bg-[#f6f2ff]/60 focus:outline-none focus:bg-[#f6f2ff]"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1c1b23] truncate">
                          {ticket.subject}
                        </p>
                        <p className="text-xs text-[#787586] mt-0.5 truncate">
                          #{ticket.ticketId} · {ticket.requesterName || "Unknown requester"}
                          {ticket.requesterEmail ? ` (${ticket.requesterEmail})` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {isAwaiting(ticket) ? <AwaitingPill /> : null}
                        <TicketStatusBadge status={ticket.status} />
                        <TicketPriorityBadge priority={ticket.priority} />
                        <span className="text-xs text-[#787586] md:w-36 md:text-right">
                          {formatTicketDate(ticket.lastReplyAt ?? ticket.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <TicketsPagination
              pagination={data.pagination}
              onPageChange={(next) => updateParams({ page: next })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
