export const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;
export const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export interface Ticket {
  ticketId: number;
  companyId: number;
  customerId: number | null;
  requesterName: string | null;
  requesterEmail: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedAgentId: number | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface TicketPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TicketListFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignee?: "unassigned" | string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TicketListResult {
  tickets: Ticket[];
  pagination: TicketPagination;
}

export interface AssignableAgent {
  userId: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  onlineStatus: string | null;
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  priority?: TicketPriority;
  status?: TicketStatus;
  requesterName?: string;
  requesterEmail?: string;
  assignedAgentId?: number | null;
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedAgentId?: number | null;
}

export interface FieldError {
  field: string;
  message: string;
}
