import type { ChatSnapshot, ChatTurnResult } from "../types/chat";
import { apiRequest } from "./apiClient";

interface Envelope<T> {
  success: boolean;
  data: T;
}

const BASE = "/api/customer/chat/sessions";
const sessionUrl = (id: number) => `${BASE}/${encodeURIComponent(String(id))}`;

/** Resumes the customer's open conversation or starts a new one. */
export async function startChat(): Promise<ChatSnapshot> {
  const response = await apiRequest<Envelope<ChatSnapshot>>(BASE, { method: "POST" });
  return response.data;
}

export async function sendChatMessage(sessionId: number, message: string): Promise<ChatTurnResult> {
  const response = await apiRequest<Envelope<ChatTurnResult>>(`${sessionUrl(sessionId)}/messages`, {
    method: "POST",
    data: { message },
  });
  return response.data;
}

export async function requestHuman(sessionId: number): Promise<ChatTurnResult> {
  const response = await apiRequest<Envelope<ChatTurnResult>>(`${sessionUrl(sessionId)}/escalate`, {
    method: "POST",
  });
  return response.data;
}

export async function resolveChat(sessionId: number): Promise<ChatTurnResult> {
  const response = await apiRequest<Envelope<ChatTurnResult>>(`${sessionUrl(sessionId)}/resolve`, {
    method: "POST",
  });
  return response.data;
}
