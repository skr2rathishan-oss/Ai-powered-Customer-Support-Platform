import type {
  TicketPagination,
  TicketPriority,
  TicketStatus,
} from "./tickets";

export type ReplyAuthorRole = "Customer" | "Agent" | "Admin";

export interface TicketReply {
  replyId: number;
  authorRole: ReplyAuthorRole;
  authorName: string | null;
  isInternal?: boolean;
  body: string;
  createdAt: string;
}

export interface AgentSummary {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  total: number;
}

export interface AgentMe {
  agent: {
    userId: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  company: { companyId: number; companyName: string };
  summary: AgentSummary;
}

export interface AgentPortalContext {
  data: AgentMe;
}

export interface AgentTicketRow {
  ticketId: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterName: string | null;
  requesterEmail: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  replyCount: number;
  lastReplyAt: string | null;
  lastReplyRole: ReplyAuthorRole | null;
}

export interface AgentTicketDetail {
  ticketId: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterName: string | null;
  requesterEmail: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export type AgentSort = "newest" | "oldest" | "priority";

export interface AgentQueueFilters {
  status?: TicketStatus;
  search?: string;
  sort?: AgentSort;
  page?: number;
  limit?: number;
}

export interface AgentQueueResult {
  tickets: AgentTicketRow[];
  summary: AgentSummary;
  pagination: TicketPagination;
}

export interface AgentTicketResult {
  ticket: AgentTicketDetail;
  replies: TicketReply[];
}
