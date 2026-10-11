import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AssignableAgent,
} from "../../../types/tickets";
import { agentLabel } from "./ticketFormat";

interface TicketFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  priority: string;
  onPriorityChange: (value: string) => void;
  assignee: string;
  onAssigneeChange: (value: string) => void;
  agents: AssignableAgent[];
  active: boolean;
  onClear: () => void;
}

const selectClass =
  "w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 px-3 text-xs text-[#1c1b23] outline-none focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] cursor-pointer";

export function TicketFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  assignee,
  onAssigneeChange,
  agents,
  active,
  onClear,
}: TicketFiltersProps) {
  return (
    <div className="bg-white border border-[#e2e4e9] rounded-2xl p-4 shadow-2xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto] gap-3 items-end">
        <div className="relative">
          <label htmlFor="ticket-search" className="sr-only">
            Search tickets
          </label>
          <span
            className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#787586] text-lg"
            aria-hidden="true"
          >
            search
          </span>
          <input
            id="ticket-search"
            type="search"
            maxLength={100}
            placeholder="Search subject or requester"
            aria-label="Search tickets"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 pl-10 pr-4 text-xs text-[#1c1b23] focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] outline-none placeholder-[#787586]"
          />
        </div>

        <div>
          <label htmlFor="ticket-filter-status" className="sr-only">
            Status
          </label>
          <select
            id="ticket-filter-status"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className={selectClass}
          >
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ticket-filter-priority" className="sr-only">
            Priority
          </label>
          <select
            id="ticket-filter-priority"
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            className={selectClass}
          >
            <option value="">All priorities</option>
            {TICKET_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ticket-filter-assignee" className="sr-only">
            Assignee
          </label>
          <select
            id="ticket-filter-assignee"
            value={assignee}
            onChange={(e) => onAssigneeChange(e.target.value)}
            className={selectClass}
          >
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.userId} value={String(agent.userId)}>
                {agentLabel(agent)}
              </option>
            ))}
            {assignee &&
            assignee !== "unassigned" &&
            !agents.some((agent) => String(agent.userId) === assignee) ? (
              <option value={assignee}>Agent #{assignee}</option>
            ) : null}
          </select>
        </div>

        {active ? (
          <button
            type="button"
            onClick={onClear}
            className="px-4 py-2 rounded-xl border border-[#e2e4e9] bg-white text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
