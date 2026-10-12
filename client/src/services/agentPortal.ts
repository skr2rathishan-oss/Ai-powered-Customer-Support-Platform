import type {
  AgentMe,
  AgentQueueFilters,
  AgentQueueResult,
  AgentTicketDetail,
  AgentTicketResult,
  TicketReply,
} from "../types/agentPortal";
import type { TicketStatus } from "../types/tickets";
import { apiRequest } from "./apiClient";

interface Envelope<T> {
  success: boolean;
  data: T;
}

const BASE = "/api/agent";
const ticketUrl = (id: number | string) =>
  `${BASE}/tickets/${encodeURIComponent(String(id))}`;

export async function getAgentMe(): Promise<AgentMe> {
  const response = await apiRequest<Envelope<AgentMe>>(`${BASE}/me`, {
    cache: "no-store",
  });
  return response.data;
}

export async function listAgentTickets(
  filters: AgentQueueFilters,
): Promise<AgentQueueResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  const response = await apiRequest<Envelope<AgentQueueResult>>(
    query ? `${BASE}/tickets?${query}` : `${BASE}/tickets`,
    { cache: "no-store" },
  );
  return response.data;
}

export async function getAgentTicket(
  ticketId: number | string,
): Promise<AgentTicketResult> {
  const response = await apiRequest<Envelope<AgentTicketResult>>(
    ticketUrl(ticketId),
    { cache: "no-store" },
  );
  return response.data;
}

export async function postAgentReply(
  ticketId: number | string,
  input: { body: string; isInternal: boolean },
): Promise<TicketReply> {
  const response = await apiRequest<Envelope<{ reply: TicketReply }>>(
    `${ticketUrl(ticketId)}/replies`,
    { data: input, method: "POST", cache: "no-store" },
  );
  return response.data.reply;
}

export async function updateAgentTicketStatus(
  ticketId: number | string,
  status: TicketStatus,
): Promise<AgentTicketDetail> {
  const response = await apiRequest<Envelope<{ ticket: AgentTicketDetail }>>(
    ticketUrl(ticketId),
    { data: { status }, method: "PATCH", cache: "no-store" },
  );
  return response.data.ticket;
}

export { getErrorCode, getFieldErrors } from "./tickets";
