import { Link } from "react-router";
import type { TicketPriority, TicketStatus } from "../../types/tickets";
import { TicketPriorityBadge } from "../company/tickets/TicketPriorityBadge";
import { TicketStatusBadge } from "../company/tickets/TicketStatusBadge";
import { DashboardEmpty } from "./DashboardCard";

export interface TicketListItem {
  ticketId: number;
  subject: string;
  status: TicketStatus;
  priority?: TicketPriority;
  meta: string;
  to: string;
}

/** Compact clickable ticket rows with status and priority badges. */
export function TicketList({ items, emptyText }: { items: TicketListItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <DashboardEmpty icon="inbox" text={emptyText} />;
  }

  return (
    <ul className="divide-y divide-[#e2e4e9]/70 -mx-2">
      {items.map((item) => (
        <li key={item.ticketId}>
          <Link
            to={item.to}
            className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-[#f6f2ff]/70 transition-colors no-underline"
          >
            <span className="text-[11px] font-mono font-semibold text-[#787586] w-10 shrink-0">
              #{item.ticketId}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#1c1b23] truncate">{item.subject}</span>
              <span className="block text-[11px] text-[#787586] truncate mt-0.5">{item.meta}</span>
            </span>
            <span className="hidden sm:flex items-center gap-1.5 shrink-0">
              {item.priority ? <TicketPriorityBadge priority={item.priority} /> : null}
              <TicketStatusBadge status={item.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
