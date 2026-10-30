import type { ReplyAuthorRole } from "./agentPortal";
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

export interface CustomerReply {
  replyId: number;
  authorRole: ReplyAuthorRole;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface CustomerTicketDetail {
  ticket: CustomerTicket;
  replies: CustomerReply[];
}

export interface CustomerReplyResult {
  reply: CustomerReply;
  ticket: CustomerTicket;
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

export type OrderStatus = "Processing" | "Shipped" | "Delivered" | "Cancelled" | "Returned";

export interface OrderItem {
  itemId: number;
  productName: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPrice: number;
}

export interface CustomerOrder {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  shippingFee: number;
  totalAmount: number;
  currency: string;
  shippingAddress: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  orderedAt: string;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
}
