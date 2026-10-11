import type { Agent } from "../../../types/agents";
import { AgentStatusBadge } from "./AgentStatusBadge";

interface AgentsTableProps {
  agents: Agent[];
  busyAgentId: number | null;
  rowErrors: Record<number, string>;
  onResend: (agent: Agent) => void;
  onDeactivate: (agent: Agent) => void;
  onReactivate: (agent: Agent) => void;
}

const actionClass =
  "px-3 py-1.5 rounded-lg border border-[#e2e4e9] bg-white text-[11px] font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30 disabled:opacity-50 disabled:cursor-not-allowed";

export function AgentsTable({
  agents,
  busyAgentId,
  rowErrors,
  onResend,
  onDeactivate,
  onReactivate,
}: AgentsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <caption className="sr-only">Support agents</caption>
        <thead>
          <tr className="border-b border-[#e2e4e9] bg-[#fbfbfe] text-[11px] font-bold uppercase tracking-wider text-[#787586]">
            <th scope="col" className="py-3.5 px-4 sm:px-6">Name</th>
            <th scope="col" className="py-3.5 px-4 hidden sm:table-cell">Email</th>
            <th scope="col" className="py-3.5 px-4">Status</th>
            <th scope="col" className="py-3.5 px-4">Open tickets</th>
            <th scope="col" className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e2e4e9]/70 text-xs text-[#1c1b23]">
          {agents.map((agent) => {
            const busy = busyAgentId === agent.agentId;
            const error = rowErrors[agent.agentId];
            return (
              <tr
                key={agent.agentId}
                className="hover:bg-[#f6f2ff]/40 transition-colors"
              >
                <td className="py-4 px-4 sm:px-6 min-w-[160px]">
                  <p className="font-bold">{agent.name || agent.email}</p>
                  <p className="text-[11px] text-[#787586] sm:hidden break-all">
                    {agent.email}
                  </p>
                  {agent.invitePending ? (
                    <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">
                      Invite pending
                    </span>
                  ) : null}
                  {error ? (
                    <p role="alert" className="mt-1.5 text-[11px] font-medium text-rose-600">
                      {error}
                    </p>
                  ) : null}
                </td>
                <td className="py-4 px-4 text-[#474555] hidden sm:table-cell">
                  {agent.email}
                </td>
                <td className="py-4 px-4">
                  <AgentStatusBadge status={agent.status} />
                </td>
                <td className="py-4 px-4 tabular-nums">{agent.openTickets}</td>
                <td className="py-4 px-4 sm:px-6">
                  <div className="flex flex-wrap justify-end gap-2">
                    {agent.invitePending && agent.status === "Active" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onResend(agent)}
                        aria-label={`Resend invite to ${agent.name}`}
                        className={actionClass}
                      >
                        Resend invite
                      </button>
                    ) : null}
                    {agent.status === "Active" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDeactivate(agent)}
                        aria-label={`Deactivate ${agent.name}`}
                        className={`${actionClass} text-rose-700 border-rose-200 hover:bg-rose-50`}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onReactivate(agent)}
                        aria-label={`Reactivate ${agent.name}`}
                        className={actionClass}
                      >
                        {busy ? "Reactivating..." : "Reactivate"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
