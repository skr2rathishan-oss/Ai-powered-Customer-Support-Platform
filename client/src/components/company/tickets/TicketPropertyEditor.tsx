import { useEffect, useRef, useState } from "react";
import { getFieldErrors, updateTicket } from "../../../services/tickets";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AssignableAgent,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
  type UpdateTicketInput,
} from "../../../types/tickets";
import { agentLabel } from "./ticketFormat";
import { useTicketAuthError } from "./useTicketAuthError";

interface TicketPropertyEditorProps {
  ticket: Ticket;
  agents: AssignableAgent[];
  agentsFailed: boolean;
  onUpdated: (ticket: Ticket) => void;
}

type Field = "status" | "priority" | "assignedAgentId";

const selectClass =
  "w-full bg-white border border-[#e2e4e9] rounded-xl py-2.5 px-3.5 text-sm text-[#1c1b23] focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] outline-none disabled:opacity-60 cursor-pointer";
const labelClass = "block text-xs font-semibold text-[#474555] mb-1.5";

export function TicketPropertyEditor({
  ticket,
  agents,
  agentsFailed,
  onUpdated,
}: TicketPropertyEditorProps) {
  const [savingField, setSavingField] = useState<Field | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const handleAuthError = useTicketAuthError();
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  async function save(field: Field, changes: UpdateTicketInput) {
    if (savingField) return;
    setSavingField(field);
    setError(null);
    setSaved(false);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    try {
      const updated = await updateTicket(ticket.ticketId, changes);
      onUpdated(updated);
      setSaved(true);
      savedTimer.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      if (handleAuthError(err)) return;
      const fieldErrors = getFieldErrors(err);
      setError(
        fieldErrors.length > 0
          ? fieldErrors.map((item) => item.message).join(" ")
          : err instanceof Error
            ? err.message
            : "Could not update the ticket.",
      );
    } finally {
      setSavingField(null);
    }
  }

  // Controls are controlled by the ticket prop, so a failed save leaves the
  // previous value in place.
  const busy = savingField !== null;
  const assigneeOptions = [...agents];
  if (
    ticket.assignedAgentId !== null &&
    !assigneeOptions.some((agent) => agent.userId === ticket.assignedAgentId)
  ) {
    assigneeOptions.push({
      userId: ticket.assignedAgentId,
      firstName: ticket.assigneeName,
      lastName: null,
      email: `Agent #${ticket.assignedAgentId}`,
      onlineStatus: null,
    });
  }

  function spinner(field: Field) {
    return savingField === field ? (
      <span
        className="inline-block w-3.5 h-3.5 ml-2 align-middle border-2 border-[#6D5EF5]/30 border-t-[#6D5EF5] rounded-full animate-spin"
        aria-hidden="true"
      />
    ) : null;
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="ticket-status" className={labelClass}>
          Status{spinner("status")}
        </label>
        <select
          id="ticket-status"
          value={ticket.status}
          disabled={busy}
          onChange={(e) =>
            void save("status", { status: e.target.value as TicketStatus })
          }
          className={selectClass}
        >
          {TICKET_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ticket-priority" className={labelClass}>
          Priority{spinner("priority")}
        </label>
        <select
          id="ticket-priority"
          value={ticket.priority}
          disabled={busy}
          onChange={(e) =>
            void save("priority", { priority: e.target.value as TicketPriority })
          }
          className={selectClass}
        >
          {TICKET_PRIORITIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ticket-assignee" className={labelClass}>
          Assignee{spinner("assignedAgentId")}
        </label>
        <select
          id="ticket-assignee"
          value={ticket.assignedAgentId === null ? "" : String(ticket.assignedAgentId)}
          disabled={busy}
          onChange={(e) =>
            void save("assignedAgentId", {
              assignedAgentId: e.target.value ? Number(e.target.value) : null,
            })
          }
          className={selectClass}
        >
          <option value="">Unassigned</option>
          {assigneeOptions.map((agent) => (
            <option key={agent.userId} value={String(agent.userId)}>
              {agentLabel(agent)}
            </option>
          ))}
        </select>
        {agentsFailed ? (
          <p className="mt-1 text-[11px] text-[#787586]">Could not load agents</p>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800"
        >
          {error}
        </div>
      ) : null}
      {saved ? (
        <p role="status" className="text-xs font-semibold text-emerald-700">
          Saved
        </p>
      ) : null}
    </div>
  );
}
