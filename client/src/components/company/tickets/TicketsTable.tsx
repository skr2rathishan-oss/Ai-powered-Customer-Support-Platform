import { Link } from "react-router";
import { companyTicketPath } from "../../../router/routes";
import type { Ticket } from "../../../types/tickets";
import { formatTicketDay } from "./ticketFormat";
import { TicketPriorityBadge } from "./TicketPriorityBadge";
import { TicketStatusBadge } from "./TicketStatusBadge";

export function TicketsTable({ tickets }: { tickets: Ticket[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <caption className="sr-only">Company support tickets</caption>
        <thead>
          <tr className="border-b border-[#e2e4e9] bg-[#fbfbfe] text-[11px] font-bold uppercase tracking-wider text-[#787586]">
            <th scope="col" className="py-3.5 px-4 sm:px-6">Ticket</th>
            <th scope="col" className="py-3.5 px-4">Status</th>
            <th scope="col" className="py-3.5 px-4">Priority</th>
            <th scope="col" className="py-3.5 px-4">Assignee</th>
            <th scope="col" className="py-3.5 px-4 hidden sm:table-cell">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e2e4e9]/70 text-xs text-[#1c1b23]">
          {tickets.map((ticket) => (
            <tr
              key={ticket.ticketId}
              className="hover:bg-[#f6f2ff]/40 transition-colors"
            >
              <td className="py-4 px-4 sm:px-6 min-w-[200px]">
                <Link
                  to={companyTicketPath(ticket.ticketId)}
                  className="font-bold text-[#1c1b23] hover:text-[#6D5EF5] no-underline"
                >
                  {ticket.subject}
                </Link>
                <p className="text-[11px] text-[#787586] mt-0.5">
                  #{ticket.ticketId}
                  <span className="hidden sm:inline">
                    {ticket.requesterName || ticket.requesterEmail
                      ? ` - ${ticket.requesterName ?? ticket.requesterEmail}`
                      : ""}
                  </span>
                </p>
              </td>
              <td className="py-4 px-4">
                <TicketStatusBadge status={ticket.status} />
              </td>
              <td className="py-4 px-4">
                <TicketPriorityBadge priority={ticket.priority} />
              </td>
              <td className="py-4 px-4 text-[#474555]">
                {ticket.assigneeName ??
                  (ticket.assignedAgentId !== null ? (
                    `Agent #${ticket.assignedAgentId}`
                  ) : (
                    <span className="text-[#787586] italic">Unassigned</span>
                  ))}
              </td>
              <td className="py-4 px-4 text-[#787586] hidden sm:table-cell whitespace-nowrap">
                {formatTicketDay(ticket.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
