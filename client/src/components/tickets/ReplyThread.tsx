import { formatTicketDate } from "../company/tickets/ticketFormat";
import type { TicketReply } from "../../types/agentPortal";

interface ReplyThreadProps {
  replies: TicketReply[];
  emptyText?: string;
  // Optional first item: the original request shown as the opening message
  opening?: { authorName: string | null; body: string; createdAt: string };
}

function roleClasses(role: TicketReply["authorRole"]): string {
  if (role === "Customer") return "bg-slate-100 text-slate-700 border-slate-200";
  if (role === "Admin") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-[#f6f2ff] text-[#6D5EF5] border-[#ddd6fe]";
}

export function ReplyThread({
  replies,
  emptyText = "No replies yet.",
  opening,
}: ReplyThreadProps) {
  if (replies.length === 0 && !opening) {
    return <p className="text-sm text-[#787586]">{emptyText}</p>;
  }

  return (
    <ol className="space-y-3" aria-label="Conversation">
      {opening ? (
        <li className="rounded-xl border border-[#e2e4e9] bg-[#fbfbfe] p-4">
          <div className="flex flex-wrap items-center gap-2 mb-1.5 text-xs">
            <span className="font-bold text-[#1c1b23]">
              {opening.authorName || "Requester"}
            </span>
            <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-slate-100 text-slate-700 border-slate-200">
              Original request
            </span>
            <span className="text-[#787586]">{formatTicketDate(opening.createdAt)}</span>
          </div>
          <p className="text-sm text-[#1c1b23] whitespace-pre-wrap break-words">
            {opening.body}
          </p>
        </li>
      ) : null}
      {replies.map((reply) => (
        <li
          key={reply.replyId}
          data-testid="reply"
          className={`rounded-xl border p-4 ${
            reply.isInternal
              ? "border-amber-300 bg-amber-50"
              : "border-[#e2e4e9] bg-white"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 mb-1.5 text-xs">
            <span className="font-bold text-[#1c1b23]">
              {reply.authorName || reply.authorRole}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${roleClasses(reply.authorRole)}`}
            >
              {reply.authorRole}
            </span>
            {reply.isInternal ? (
              <span className="px-2 py-0.5 rounded-full border border-amber-300 bg-amber-100 text-amber-900 text-[10px] font-bold">
                Internal note - not visible to the customer
              </span>
            ) : null}
            <span className="text-[#787586]">{formatTicketDate(reply.createdAt)}</span>
          </div>
          <p className="text-sm text-[#1c1b23] whitespace-pre-wrap break-words">
            {reply.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
