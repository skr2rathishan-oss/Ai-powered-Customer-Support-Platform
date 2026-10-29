export type ChatSender = "customer" | "assistant" | "system";
export type ChatStatus = "Active" | "Resolved" | "Escalated";

export interface ChatMessage {
  messageId: number;
  sender: ChatSender;
  body: string;
  confidence: number | null;
  createdAt?: string;
}

export interface ChatSession {
  sessionId: number;
  status: ChatStatus;
  ticketId: number | null;
  createdAt: string;
}

export interface ChatAssistantInfo {
  enabled: boolean;
  assistantName: string;
  poweredBy: "ai" | "faq-match";
}

export interface ChatSnapshot {
  session: ChatSession;
  messages: ChatMessage[];
  assistant: ChatAssistantInfo;
}

export interface ChatTurnResult {
  session: ChatSession;
  messages: ChatMessage[];
  ticket: { ticketId: number; assignedTo: string | null } | null;
}
