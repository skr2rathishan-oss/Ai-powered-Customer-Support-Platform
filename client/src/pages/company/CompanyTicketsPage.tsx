import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CreateTicketModal } from "../../components/company/tickets/CreateTicketModal";
import { TicketFilters } from "../../components/company/tickets/TicketFilters";
import { TicketsPagination } from "../../components/company/tickets/TicketsPagination";
import { TicketsTable } from "../../components/company/tickets/TicketsTable";
import {
  ticketFiltersFromSearchParams,
  PAGE_SIZE,
  ticketFiltersToSearchParams,
} from "../../components/company/tickets/ticketFormat";
import { useCompanyPortal } from "../../components/company/useCompanyPortal";
import { companyTicketPath, ROUTES } from "../../router/routes";
import {
  ApiError,
  removeAuthToken,
  removeStoredUser,
} from "../../services/apiClient";
import { listAssignableAgents, listTickets } from "../../services/tickets";
import type {
  AssignableAgent,
  Ticket,
  TicketListFilters,
  TicketListResult,
} from "../../types/tickets";

const SEARCH_DEBOUNCE_MS = 300;

interface Outcome {
  key: string;
  data?: TicketListResult;
  error?: string;
}

export function CompanyTicketsPage() {
  const portal = useCompanyPortal();
  const { refresh } = portal;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = ticketFiltersFromSearchParams(searchParams);
  const page = filters.page ?? 1;
  const limit = filters.limit ?? PAGE_SIZE;

  const key = ticketFiltersToSearchParams(filters).toString() + `|${page}|${limit}`;
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${key}|${reloadToken}`;
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [syncedSearch, setSyncedSearch] = useState(filters.search ?? "");
  // Last search value this page pushed to the URL itself; used to tell our own
  // URL updates apart from external navigation.
  const [pushedSearch, setPushedSearch] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newTicketButton = useRef<HTMLButtonElement>(null);

  // Keep the input in step with the URL when it changes from outside (Clear,
  // browser back/forward).
  if ((filters.search ?? "") !== syncedSearch) {
    const urlSearch = filters.search ?? "";
    setSyncedSearch(urlSearch);
    if (urlSearch === pushedSearch) {
      setPushedSearch(null);
    } else {
      setSearchInput(urlSearch);
    }
  }

  const updateParams = useCallback(
    (changes: TicketListFilters, replace = false) => {
      setSearchParams(
        (current) => {
          const next = ticketFiltersFromSearchParams(current);
          return ticketFiltersToSearchParams({ ...next, ...changes });
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    listAssignableAgents()
      .then((list) => {
        if (!cancelled) setAgents(list);
      })
      .catch(() => {
        // Non-fatal: the list works without agent options.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = ticketFiltersFromSearchParams(
      new URLSearchParams(key.split("|")[0]),
    );
    params.page = page;
    params.limit = limit;

    listTickets(params)
      .then((data) => {
        if (!cancelled) setOutcome({ key: requestKey, data });
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
        setOutcome({
          key: requestKey,
          error:
            error instanceof Error ? error.message : "Could not load tickets.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [key, requestKey, page, limit, navigate, refresh]);

  const loading = outcome?.key !== requestKey;
  const data = outcome?.data;
  const error = !loading ? outcome?.error : undefined;

  const totalPages = data?.pagination.totalPages ?? 0;
  useEffect(() => {
    if (!loading && data && totalPages > 0 && page > totalPages) {
      const next = ticketFiltersFromSearchParams(searchParams);
      next.page = totalPages;
      setSearchParams(ticketFiltersToSearchParams(next), { replace: true });
    }
  }, [loading, data, totalPages, page, searchParams, setSearchParams]);

  const hasFilters = Boolean(
    filters.status || filters.priority || filters.assignee || filters.search,
  );

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPushedSearch(value.trim());
      updateParams({ search: value.trim() || undefined, page: 1 }, true);
    }, SEARCH_DEBOUNCE_MS);
  }

  function clearFilters() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchInput("");
    setSyncedSearch("");
    setPushedSearch(null);
    const next: TicketListFilters = { page: 1, limit };
    setSearchParams(ticketFiltersToSearchParams(next));
  }

  function closeModal() {
    setModalOpen(false);
    newTicketButton.current?.focus();
  }

  function handleCreated(ticket: Ticket) {
    setModalOpen(false);
    void refresh();
    navigate(companyTicketPath(ticket.ticketId), {
      state: { toast: `Ticket #${ticket.ticketId} created` },
    });
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
            <h1 className="text-2xl font-bold text-[#1c1b23] leading-tight">Tickets</h1>
            <p className="text-sm text-[#787586]">
              Review, assign and resolve your customers' support requests.
            </p>
          </div>
        </div>
        <button
          ref={newTicketButton}
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-sm font-bold shadow-md shadow-[#6D5EF5]/20 flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/40"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            add
          </span>
          New ticket
        </button>
      </div>

      <TicketFilters
        search={searchInput}
        onSearchChange={handleSearchChange}
        status={filters.status ?? ""}
        onStatusChange={(value) =>
          updateParams({ status: (value || undefined) as TicketListFilters["status"], page: 1 })
        }
        priority={filters.priority ?? ""}
        onPriorityChange={(value) =>
          updateParams({ priority: (value || undefined) as TicketListFilters["priority"], page: 1 })
        }
        assignee={filters.assignee ?? ""}
        onAssigneeChange={(value) =>
          updateParams({ assignee: value || undefined, page: 1 })
        }
        agents={agents}
        active={hasFilters || searchInput.trim() !== ""}
        onClear={clearFilters}
      />

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
              Try again
            </button>
          </div>
        ) : showEmpty ? (
          hasFilters ? (
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
            <div className="p-12 text-center space-y-3">
              <p className="font-semibold text-sm text-[#1c1b23]">No tickets yet</p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-xs font-bold cursor-pointer"
              >
                Create your first ticket
              </button>
            </div>
          )
        ) : data ? (
          <div className={loading ? "opacity-60" : undefined}>
            <TicketsTable tickets={tickets} />
            <TicketsPagination
              pagination={data.pagination}
              onPageChange={(next) => updateParams({ page: next })}
            />
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <CreateTicketModal
          agents={agents}
          onClose={closeModal}
          onCreated={handleCreated}
        />
      ) : null}
    </div>
  );
}
