import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AgentsTable } from "../../components/company/agents/AgentsTable";
import { AgentStatusDialog } from "../../components/company/agents/AgentStatusDialog";
import { InviteAgentModal } from "../../components/company/agents/InviteAgentModal";
import { useCompanyPortal } from "../../components/company/useCompanyPortal";
import { ROUTES } from "../../router/routes";
import {
  listAgents,
  resendInvite,
  setAgentStatus,
} from "../../services/agents";
import {
  ApiError,
  removeAuthToken,
  removeStoredUser,
} from "../../services/apiClient";
import type {
  Agent,
  AgentListResult,
  InviteAgentResult,
} from "../../types/agents";

interface Outcome {
  key: number;
  data?: AgentListResult;
  error?: string;
}

const chipClass =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#e2e4e9] bg-white text-xs font-semibold text-[#474555]";
const selectClass =
  "w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3 text-xs text-[#1c1b23] outline-none focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] cursor-pointer";

export function CompanyAgentsPage() {
  const { refresh } = useCompanyPortal();
  const navigate = useNavigate();

  const [reloadToken, setReloadToken] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [dialogAgent, setDialogAgent] = useState<Agent | null>(null);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busyAgentId, setBusyAgentId] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");

  const inviteButton = useRef<HTMLButtonElement>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);

  // Returns true when the failure was a session problem that was handled
  const handleAuthError = useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiError)) return false;
      if (error.status === 401) {
        removeAuthToken();
        removeStoredUser();
        navigate(ROUTES.LOGIN_COMPANY, { replace: true });
        return true;
      }
      if (error.status === 403) void refresh();
      return false;
    },
    [navigate, refresh],
  );

  useEffect(() => {
    let cancelled = false;
    listAgents()
      .then((data) => {
        if (!cancelled) setOutcome({ key: reloadToken, data });
      })
      .catch((error: unknown) => {
        if (cancelled || handleAuthError(error)) return;
        setOutcome({
          key: reloadToken,
          error:
            error instanceof Error ? error.message : "Could not load agents.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, handleAuthError]);

  const reload = () => setReloadToken((n) => n + 1);

  const loading = outcome?.key !== reloadToken;
  const data = outcome?.data;
  const error = !loading ? outcome?.error : undefined;
  const summary = data?.summary;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.agents ?? []).filter((agent) => {
      if (statusFilter && agent.status !== statusFilter) return false;
      if (!term) return true;
      return (
        agent.name.toLowerCase().includes(term) ||
        agent.email.toLowerCase().includes(term)
      );
    });
  }, [data, search, statusFilter]);

  const hasFilters = search.trim() !== "" || statusFilter !== "";

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
  }

  function setRowError(agentId: number, text: string | null) {
    setRowErrors((current) => {
      const next = { ...current };
      if (text) next[agentId] = text;
      else delete next[agentId];
      return next;
    });
  }

  function openInvite() {
    setInviteOpen(true);
  }

  function closeInvite() {
    setInviteOpen(false);
    inviteButton.current?.focus();
  }

  function handleInvited(result: InviteAgentResult) {
    setInviteOpen(false);
    inviteButton.current?.focus();
    if (result.emailSent) {
      setWarning("");
      setMessage(`Invite sent to ${result.agent.email}`);
    } else {
      setMessage("");
      setWarning(
        "Agent created but the email could not be sent. Use Resend invite.",
      );
    }
    reload();
    void refresh();
  }

  async function handleResend(agent: Agent) {
    setBusyAgentId(agent.agentId);
    setRowError(agent.agentId, null);
    try {
      const result = await resendInvite(agent.agentId);
      if (result.emailSent) {
        setWarning("");
        setMessage(`Invite sent to ${agent.email}`);
      } else {
        setMessage("");
        setWarning("The invite email could not be sent. Try again later.");
      }
    } catch (failure) {
      if (!handleAuthError(failure)) {
        setRowError(
          agent.agentId,
          failure instanceof Error ? failure.message : "Could not resend the invite.",
        );
      }
    } finally {
      setBusyAgentId(null);
    }
    reload();
  }

  async function handleReactivate(agent: Agent) {
    setBusyAgentId(agent.agentId);
    setRowError(agent.agentId, null);
    try {
      await setAgentStatus(agent.agentId, "Active");
      setWarning("");
      setMessage(`${agent.name} reactivated`);
      void refresh();
    } catch (failure) {
      if (!handleAuthError(failure)) {
        setRowError(
          agent.agentId,
          failure instanceof Error ? failure.message : "Could not reactivate the agent.",
        );
      }
    } finally {
      setBusyAgentId(null);
    }
    reload();
  }

  function openDeactivate(agent: Agent) {
    dialogTrigger.current = document.activeElement as HTMLElement | null;
    setDialogError(null);
    setDialogAgent(agent);
  }

  const closeDialog = useCallback(() => {
    setDialogAgent(null);
    const trigger = dialogTrigger.current;
    if (trigger && trigger.isConnected) trigger.focus();
  }, []);

  async function confirmDeactivate() {
    if (!dialogAgent) return;
    const agent = dialogAgent;
    setDialogSaving(true);
    setDialogError(null);
    try {
      const result = await setAgentStatus(agent.agentId, "Inactive");
      const count = result.unassignedTickets;
      setWarning("");
      setMessage(
        `${agent.name} deactivated. ${count} ${count === 1 ? "ticket" : "tickets"} unassigned.`,
      );
      setDialogAgent(null);
      reload();
      void refresh();
    } catch (failure) {
      if (!handleAuthError(failure)) {
        setDialogError(
          failure instanceof Error ? failure.message : "Could not deactivate the agent.",
        );
      }
    } finally {
      setDialogSaving(false);
    }
  }

  const showEmpty = !loading && !error && data && data.agents.length === 0;
  const showNoMatch =
    !loading && !error && data && data.agents.length > 0 && visible.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#6D5EF5]/10 text-[#6D5EF5] flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">
              support_agent
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1c1b23] leading-tight">Agents</h1>
            <p className="text-sm text-[#787586]">
              Invite support agents and manage who handles your tickets.
            </p>
          </div>
        </div>
        <button
          ref={inviteButton}
          type="button"
          onClick={openInvite}
          className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-sm font-bold shadow-md shadow-[#6D5EF5]/20 flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/40"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            person_add
          </span>
          Invite agent
        </button>
      </div>

      {summary ? (
        <ul className="flex flex-wrap gap-2" aria-label="Agent summary">
          <li className={chipClass}>Active {summary.active}</li>
          <li className={chipClass}>Inactive {summary.inactive}</li>
          <li className={chipClass}>Invite pending {summary.invitePending}</li>
        </ul>
      ) : null}

      <div role="status" className={message ? "" : "sr-only"}>
        {message ? (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            {message}
          </div>
        ) : null}
      </div>
      {warning ? (
        <div
          role="alert"
          className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800"
        >
          {warning}
        </div>
      ) : null}

      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] gap-3 items-end">
          <div className="relative">
            <label htmlFor="agent-search" className="sr-only">
              Search agents
            </label>
            <span
              className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#787586] text-lg"
              aria-hidden="true"
            >
              search
            </span>
            <input
              id="agent-search"
              type="search"
              maxLength={100}
              placeholder="Search name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 pl-10 pr-4 text-xs text-[#1c1b23] focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] outline-none placeholder-[#787586]"
            />
          </div>
          <div>
            <label htmlFor="agent-filter-status" className="sr-only">
              Status
            </label>
            <select
              id="agent-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl border border-[#e2e4e9] bg-white text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="bg-white border border-[#e2e4e9] rounded-2xl shadow-2xs overflow-hidden"
        aria-busy={loading}
      >
        {loading && !data ? (
          <div role="status" className="p-6 space-y-3" aria-label="Loading agents">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-10 rounded-xl bg-slate-100 animate-pulse" />
            ))}
            <span className="sr-only">Loading agents...</span>
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
              onClick={reload}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : showEmpty ? (
          <div className="p-12 text-center space-y-3">
            <p className="font-semibold text-sm text-[#1c1b23]">
              No support agents yet
            </p>
            <button
              type="button"
              onClick={openInvite}
              className="px-4 py-2 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-xs font-bold cursor-pointer"
            >
              Invite agent
            </button>
          </div>
        ) : showNoMatch ? (
          <div className="p-12 text-center space-y-3">
            <p className="font-semibold text-sm text-[#1c1b23]">
              No agents match your filters
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl border border-[#e2e4e9] text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : data ? (
          <div className={loading ? "opacity-60" : undefined}>
            <AgentsTable
              agents={visible}
              busyAgentId={busyAgentId}
              rowErrors={rowErrors}
              onResend={(agent) => void handleResend(agent)}
              onDeactivate={openDeactivate}
              onReactivate={(agent) => void handleReactivate(agent)}
            />
          </div>
        ) : null}
      </div>

      {inviteOpen ? (
        <InviteAgentModal onClose={closeInvite} onInvited={handleInvited} />
      ) : null}
      {dialogAgent ? (
        <AgentStatusDialog
          agent={dialogAgent}
          saving={dialogSaving}
          error={dialogError}
          onCancel={closeDialog}
          onConfirm={() => void confirmDeactivate()}
        />
      ) : null}
    </div>
  );
}
