import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AssignableAgent,
  type TicketListFilters,
  type TicketPriority,
  type TicketStatus,
} from "../../../types/tickets";

export const PAGE_SIZE = 10;

export function agentLabel(
  agent: Pick<AssignableAgent, "firstName" | "lastName" | "email">,
): string {
  const name = [agent.firstName, agent.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
  return name || agent.email;
}

export function formatTicketDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTicketDay(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function statusBadgeClasses(status: TicketStatus): string {
  switch (status) {
    case "Open":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "In Progress":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Resolved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function priorityBadgeClasses(priority: TicketPriority): string {
  switch (priority) {
    case "Urgent":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "High":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Medium":
      return "bg-[#f6f2ff] text-[#6D5EF5] border-[#ddd6fe]";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function ticketFiltersFromSearchParams(
  sp: URLSearchParams,
): TicketListFilters {
  const filters: TicketListFilters = {};

  const status = sp.get("status");
  if (status && (TICKET_STATUSES as readonly string[]).includes(status)) {
    filters.status = status as TicketStatus;
  }
  const priority = sp.get("priority");
  if (priority && (TICKET_PRIORITIES as readonly string[]).includes(priority)) {
    filters.priority = priority as TicketPriority;
  }
  const assignee = sp.get("assignee");
  if (assignee && (assignee === "unassigned" || /^[1-9]\d*$/.test(assignee))) {
    filters.assignee = assignee;
  }
  const search = (sp.get("search") ?? "").trim().slice(0, 100);
  if (search) filters.search = search;

  const page = sp.get("page");
  filters.page = page && /^[1-9]\d{0,8}$/.test(page) ? Number(page) : 1;

  const limit = sp.get("limit");
  const parsedLimit = limit && /^\d{1,3}$/.test(limit) ? Number(limit) : NaN;
  filters.limit =
    parsedLimit >= 1 && parsedLimit <= 100 ? parsedLimit : PAGE_SIZE;

  return filters;
}

export function ticketFiltersToSearchParams(
  filters: TicketListFilters,
): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.status) sp.set("status", filters.status);
  if (filters.priority) sp.set("priority", filters.priority);
  if (filters.assignee) sp.set("assignee", filters.assignee);
  if (filters.search) sp.set("search", filters.search);
  if (filters.page && filters.page > 1) sp.set("page", String(filters.page));
  if (filters.limit && filters.limit !== PAGE_SIZE) {
    sp.set("limit", String(filters.limit));
  }
  return sp;
}
