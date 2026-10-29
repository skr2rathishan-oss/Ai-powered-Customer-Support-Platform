import type { TicketStatus } from "../../../types/tickets";
import { statusBadgeClasses } from "./ticketFormat";

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${statusBadgeClasses(status)}`}
    >
      {status}
    </span>
  );
}
