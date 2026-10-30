import type {
  CreateCustomerTicketInput,
  CustomerOrder,
  CustomerMe,
  CustomerRegistrationValues,
  CustomerReplyResult,
  CustomerTicket,
  CustomerTicketDetail,
  CustomerTicketFilters,
  CustomerTicketListResult,
  PublicCompany,
  PublicFaqResult,
} from "../types/customer";
import type { AuthUser } from "../types/auth";
import {
  apiRequest,
  setAuthToken,
  setStoredUser,
} from "./apiClient";

interface Envelope<T> {
  success: boolean;
  data: T;
}

const TICKETS = "/api/customer/tickets";

export async function listPublicCompanies(): Promise<PublicCompany[]> {
  const response = await apiRequest<Envelope<{ companies: PublicCompany[] }>>(
    "/api/public/companies",
    { cache: "no-store" },
  );
  return response.data.companies;
}

export async function registerCustomer(
  values: Omit<CustomerRegistrationValues, "confirmPassword">,
): Promise<AuthUser> {
  const response = await apiRequest<
    Envelope<{ user: AuthUser; token?: string }> & { message?: string }
  >("/api/auth/customer/register", {
    method: "POST",
    data: {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim().toLowerCase(),
      password: values.password,
      companyId: Number(values.companyId),
    },
  });

  if (response.data.token) setAuthToken(response.data.token);
  setStoredUser(response.data.user);
  window.dispatchEvent(
    new CustomEvent("supportpilot:authenticated", {
      detail: { mode: "individual", user: response.data.user },
    }),
  );
  return response.data.user;
}

export async function getCustomerMe(): Promise<CustomerMe> {
  const response = await apiRequest<Envelope<CustomerMe>>("/api/customer/me", {
    cache: "no-store",
  });
  return response.data;
}

export async function listCustomerFaqs(
  filters: { search?: string; category?: string } = {},
): Promise<PublicFaqResult> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  const query = params.toString();
  const response = await apiRequest<Envelope<PublicFaqResult>>(
    query ? `/api/customer/faqs?${query}` : "/api/customer/faqs",
    { cache: "no-store" },
  );
  return response.data;
}

export async function listCustomerTickets(
  filters: CustomerTicketFilters,
): Promise<CustomerTicketListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  const response = await apiRequest<Envelope<CustomerTicketListResult>>(
    query ? `${TICKETS}?${query}` : TICKETS,
    { cache: "no-store" },
  );
  return response.data;
}

export async function getCustomerTicket(
  ticketId: number | string,
): Promise<CustomerTicketDetail> {
  const response = await apiRequest<Envelope<CustomerTicketDetail>>(
    `${TICKETS}/${encodeURIComponent(String(ticketId))}`,
    { cache: "no-store" },
  );
  return response.data;
}

export async function postCustomerReply(
  ticketId: number | string,
  body: string,
): Promise<CustomerReplyResult> {
  const response = await apiRequest<Envelope<CustomerReplyResult>>(
    `${TICKETS}/${encodeURIComponent(String(ticketId))}/replies`,
    { data: { body }, method: "POST", cache: "no-store" },
  );
  return response.data;
}

export async function createCustomerTicket(
  input: CreateCustomerTicketInput,
): Promise<CustomerTicket> {
  const response = await apiRequest<Envelope<{ ticket: CustomerTicket }>>(
    TICKETS,
    { data: input, method: "POST", cache: "no-store" },
  );
  return response.data.ticket;
}

export { getErrorCode, getFieldErrors } from "./tickets";

export async function listCustomerOrders(): Promise<CustomerOrder[]> {
  const response = await apiRequest<Envelope<{ orders: CustomerOrder[] }>>(
    "/api/customer/orders",
    { cache: "no-store" },
  );
  return response.data.orders;
}
