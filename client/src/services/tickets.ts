import type { TicketReply } from "../types/agentPortal";
import type {
  AssignableAgent,
  CreateTicketInput,
  FieldError,
  Ticket,
  TicketListFilters,
  TicketListResult,
  TicketStats,
  UpdateTicketInput,
} from "../types/tickets";
import { ApiError, apiRequest } from "./apiClient";

interface Envelope<T> {
  success: boolean;
  data: T;
}

const BASE = "/api/company/tickets";

export async function listTickets(
  filters: TicketListFilters,
): Promise<TicketListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  const response = await apiRequest<Envelope<TicketListResult>>(
    query ? `${BASE}?${query}` : BASE,
    { cache: "no-store" },
  );
  return response.data;
}

export async function getTicket(ticketId: number | string): Promise<Ticket> {
  const response = await apiRequest<Envelope<{ ticket: Ticket }>>(
    `${BASE}/${encodeURIComponent(String(ticketId))}`,
    { cache: "no-store" },
  );
  return response.data.ticket;
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const response = await apiRequest<Envelope<{ ticket: Ticket }>>(BASE, {
    data: input,
    method: "POST",
  });
  return response.data.ticket;
}

export async function updateTicket(
  ticketId: number | string,
  changes: UpdateTicketInput,
): Promise<Ticket> {
  const response = await apiRequest<Envelope<{ ticket: Ticket }>>(
    `${BASE}/${encodeURIComponent(String(ticketId))}`,
    { data: changes, method: "PATCH" },
  );
  return response.data.ticket;
}

export async function listTicketReplies(
  ticketId: number | string,
): Promise<TicketReply[]> {
  const response = await apiRequest<Envelope<{ replies: TicketReply[] }>>(
    `${BASE}/${encodeURIComponent(String(ticketId))}/replies`,
    { cache: "no-store" },
  );
  return response.data.replies;
}

export async function postTicketReply(
  ticketId: number | string,
  input: { body: string; isInternal: boolean },
): Promise<TicketReply> {
  const response = await apiRequest<Envelope<{ reply: TicketReply }>>(
    `${BASE}/${encodeURIComponent(String(ticketId))}/replies`,
    { data: input, method: "POST", cache: "no-store" },
  );
  return response.data.reply;
}

export async function listAssignableAgents(): Promise<AssignableAgent[]> {
  const response = await apiRequest<Envelope<{ agents: AssignableAgent[] }>>(
    `${BASE}/assignable-agents`,
    { cache: "no-store" },
  );
  return response.data.agents;
}

export async function getTicketStats(): Promise<TicketStats> {
  const response = await apiRequest<Envelope<TicketStats>>(`${BASE}/stats`, {
    cache: "no-store",
  });
  return response.data;
}

export function getFieldErrors(error: unknown): FieldError[] {
  if (!(error instanceof ApiError) || error.status !== 422) return [];
  const payload = error.payload as { errors?: unknown } | null | undefined;
  if (!payload || !Array.isArray(payload.errors)) return [];
  return payload.errors.filter(
    (item): item is FieldError =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as FieldError).field === "string" &&
      typeof (item as FieldError).message === "string",
  );
}

export function getErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const payload = error.payload as { code?: string } | null | undefined;
  return payload?.code ?? null;
}
