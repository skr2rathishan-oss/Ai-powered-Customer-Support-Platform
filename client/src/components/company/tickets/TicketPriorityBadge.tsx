import type { TicketPriority } from "../../../types/tickets";
import { priorityBadgeClasses } from "./ticketFormat";

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span
      data-testid="priority-badge"
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${priorityBadgeClasses(priority)}`}
    >
      {priority}
    </span>
  );
}
