import type {
  AgentFieldError,
  AgentListResult,
  AgentStatus,
  AgentStatusResult,
  InviteAgentInput,
  InviteAgentResult,
} from "../types/agents";
import { ApiError, apiRequest } from "./apiClient";

interface Envelope<T> {
  success: boolean;
  data: T;
}

const BASE = "/api/company/agents";

export async function listAgents(): Promise<AgentListResult> {
  const response = await apiRequest<Envelope<AgentListResult>>(BASE, {
    cache: "no-store",
  });
  return response.data;
}

export async function inviteAgent(
  input: InviteAgentInput,
): Promise<InviteAgentResult> {
  const response = await apiRequest<Envelope<InviteAgentResult>>(BASE, {
    data: input,
    method: "POST",
  });
  return response.data;
}

export async function resendInvite(
  agentId: number,
): Promise<{ emailSent: boolean }> {
  const response = await apiRequest<Envelope<{ emailSent: boolean }>>(
    `${BASE}/${agentId}/resend-invite`,
    { method: "POST" },
  );
  return response.data;
}

export async function setAgentStatus(
  agentId: number,
  status: AgentStatus,
): Promise<AgentStatusResult> {
  const response = await apiRequest<Envelope<AgentStatusResult>>(
    `${BASE}/${agentId}`,
    { data: { status }, method: "PATCH" },
  );
  return response.data;
}

// Field errors arrive with 422 (validation) and 409 (email already in use)
export function getAgentFieldErrors(error: unknown): AgentFieldError[] {
  if (!(error instanceof ApiError)) return [];
  if (error.status !== 422 && error.status !== 409) return [];
  const payload = error.payload as { errors?: unknown } | null | undefined;
  if (!payload || !Array.isArray(payload.errors)) return [];
  return payload.errors.filter(
    (item): item is AgentFieldError =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as AgentFieldError).field === "string" &&
      typeof (item as AgentFieldError).message === "string",
  );
}
