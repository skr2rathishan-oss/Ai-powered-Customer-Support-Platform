import type {
  TicketPagination,
  TicketPriority,
  TicketStatus,
} from "./tickets";

export type { FieldError, TicketPagination } from "./tickets";

export interface CustomerTicket {
  ticketId: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface CustomerTicketFilters {
  status?: TicketStatus;
  page?: number;
  limit?: number;
}

export interface CustomerTicketListResult {
  tickets: CustomerTicket[];
  pagination: TicketPagination;
}

export interface CustomerAssistant {
  enabled: boolean;
  assistantName: string;
  greeting: string;
}

export interface CustomerMe {
  customer: {
    userId: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  company: { companyId: number; companyName: string };
  assistant: CustomerAssistant;
}

export interface CustomerPortalContext {
  data: CustomerMe;
}

export interface PublicFaq {
  faqId: number;
  question: string;
  answer: string;
  category: string | null;
}

export interface PublicFaqResult {
  faqs: PublicFaq[];
  categories: string[];
}

export interface PublicCompany {
  companyId: number;
  companyName: string;
}

export interface CustomerRegistrationValues {
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export type CustomerRegistrationField = keyof CustomerRegistrationValues;
export type CustomerRegistrationErrors = Partial<
  Record<CustomerRegistrationField, string>
>;

export interface CreateCustomerTicketInput {
  subject: string;
  description: string;
}
