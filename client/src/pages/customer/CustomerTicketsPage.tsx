import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { TicketPriorityBadge } from "../../components/company/tickets/TicketPriorityBadge";
import { TicketStatusBadge } from "../../components/company/tickets/TicketStatusBadge";
import { TicketsPagination } from "../../components/company/tickets/TicketsPagination";
import { formatTicketDay } from "../../components/company/tickets/ticketFormat";
import { useCustomerAuthError } from "../../components/customer/useCustomerAuthError";
import { customerTicketPath, ROUTES } from "../../router/routes";
import { listCustomerTickets } from "../../services/customer";
import type { CustomerTicketListResult } from "../../types/customer";
import { TICKET_STATUSES, type TicketStatus } from "../../types/tickets";

const PAGE_SIZE = 10;

interface Outcome {
  key: string;
  data?: CustomerTicketListResult;
  error?: string;
}

function parseStatus(raw: string | null): TicketStatus | undefined {
  return raw && (TICKET_STATUSES as readonly string[]).includes(raw)
    ? (raw as TicketStatus)
    : undefined;
}

function parsePage(raw: string | null): number {
  return raw && /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : 1;
}

export function CustomerTicketsPage() {
  const navigate = useNavigate();
  const handleAuthError = useCustomerAuthError();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = parseStatus(searchParams.get("status"));
  const page = parsePage(searchParams.get("page"));

  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${status ?? ""}|${page}|${reloadToken}`;
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    let cancelled = false;

    listCustomerTickets({ status, page, limit: PAGE_SIZE })
      .then((data) => {
        if (!cancelled) setOutcome({ key: requestKey, data });
      })
      .catch((error: unknown) => {
        if (cancelled || handleAuthError(error)) return;
        setOutcome({
          key: requestKey,
          error:
            error instanceof Error ? error.message : "Could not load tickets.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [status, page, requestKey, handleAuthError]);

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

  function updateParams(changes: { status?: string; page?: number }) {
    const next = new URLSearchParams(searchParams);
    if ("status" in changes) {
      if (changes.status) next.set("status", changes.status);
      else next.delete("status");
      next.delete("page");
    }
    if (changes.page !== undefined) {
      if (changes.page > 1) next.set("page", String(changes.page));
      else next.delete("page");
    }
    setSearchParams(next);
  }

  const tickets = data?.tickets ?? [];
  const showEmpty = !loading && !error && data && data.pagination.total === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#6D5EF5]/10 text-[#6D5EF5] flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">
              confirmation_number
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1c1b23] leading-tight">My tickets</h1>
            <p className="text-sm text-[#787586]">
              Track the support requests you have submitted.
            </p>
          </div>
        </div>
        <Link
          to={ROUTES.CUSTOMER_NEW_TICKET}
          className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-sm font-bold shadow-md shadow-[#6D5EF5]/20 flex items-center justify-center gap-1.5 no-underline focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/40"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            add
          </span>
          New ticket
        </Link>
      </div>

      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-4 shadow-2xs flex flex-wrap items-center gap-3">
        <label htmlFor="customer-status-filter" className="text-xs font-semibold text-[#474555]">
          Status
        </label>
        <select
          id="customer-status-filter"
          value={status ?? ""}
          onChange={(event) => updateParams({ status: event.target.value })}
          className="rounded-lg border border-[#e2e4e9] bg-white px-3 py-2 text-sm text-[#1c1b23] focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30"
        >
          <option value="">All statuses</option>
          {TICKET_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {status ? (
          <button
            type="button"
            onClick={() => updateParams({ status: "" })}
            className="px-3 py-2 rounded-lg border border-[#e2e4e9] text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer"
          >
            Clear filter
          </button>
        ) : null}
      </div>

      <div
        className="bg-white border border-[#e2e4e9] rounded-2xl shadow-2xs overflow-hidden"
        aria-busy={loading}
      >
        {loading && !data ? (
          <div
            role="status"
            className="p-12 flex flex-col items-center gap-3 text-sm text-[#787586]"
          >
            <span className="inline-block w-6 h-6 border-2 border-[#6D5EF5]/30 border-t-[#6D5EF5] rounded-full animate-spin" aria-hidden="true" />
            Loading tickets...
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
          status ? (
            <div className="p-12 text-center space-y-3">
              <p className="font-semibold text-sm text-[#1c1b23]">
                No tickets match this status
              </p>
              <button
                type="button"
                onClick={() => updateParams({ status: "" })}
                className="px-4 py-2 rounded-xl border border-[#e2e4e9] text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          ) : (
            <div className="p-12 text-center space-y-3">
              <p className="font-semibold text-sm text-[#1c1b23]">
                You have not submitted any tickets yet
              </p>
              <Link
                to={ROUTES.CUSTOMER_NEW_TICKET}
                className="inline-flex px-4 py-2 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-xs font-bold no-underline"
              >
                Submit your first ticket
              </Link>
            </div>
          )
        ) : data ? (
          <div className={loading ? "opacity-60" : undefined}>
            <ul className="divide-y divide-[#e2e4e9]" aria-label="Your tickets">
              {tickets.map((ticket) => (
                <li key={ticket.ticketId}>
                  <button
                    type="button"
                    onClick={() => navigate(customerTicketPath(ticket.ticketId))}
                    className="w-full text-left px-5 py-4 hover:bg-[#f6f2ff]/60 focus:outline-none focus:bg-[#f6f2ff] cursor-pointer flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#1c1b23] truncate">
                        {ticket.subject}
                      </span>
                      <span className="block text-xs text-[#787586] mt-0.5">
                        #{ticket.ticketId} · Submitted {formatTicketDay(ticket.createdAt)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <TicketStatusBadge status={ticket.status} />
                      <TicketPriorityBadge priority={ticket.priority} />
                    </span>
                  </button>
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
