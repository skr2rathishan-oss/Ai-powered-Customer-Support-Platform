import type {
  Faq,
  FaqFieldError,
  FaqFilters,
  FaqInput,
  FaqListResult,
} from "../types/faqs";
import { ApiError, apiRequest } from "./apiClient";

interface Envelope<T> {
  success: boolean;
  data: T;
}

const BASE = "/api/company/faqs";

export async function listFaqs(filters: FaqFilters): Promise<FaqListResult> {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();

  const response = await apiRequest<Envelope<FaqListResult>>(
    query ? `${BASE}?${query}` : BASE,
    { cache: "no-store" },
  );
  return response.data;
}

export async function createFaq(input: FaqInput): Promise<Faq> {
  const response = await apiRequest<Envelope<{ faq: Faq }>>(BASE, {
    data: input,
    method: "POST",
  });
  return response.data.faq;
}

export async function updateFaq(faqId: number, input: FaqInput): Promise<Faq> {
  const response = await apiRequest<Envelope<{ faq: Faq }>>(`${BASE}/${faqId}`, {
    data: input,
    method: "PATCH",
  });
  return response.data.faq;
}

export async function deleteFaq(faqId: number): Promise<void> {
  await apiRequest<Envelope<{ deleted: boolean; faqId: number }>>(
    `${BASE}/${faqId}`,
    { method: "DELETE" },
  );
}

export function getFaqFieldErrors(error: unknown): FaqFieldError[] {
  if (!(error instanceof ApiError) || error.status !== 422) return [];
  const payload = error.payload as { errors?: unknown } | null | undefined;
  if (!payload || !Array.isArray(payload.errors)) return [];
  return payload.errors.filter(
    (item): item is FaqFieldError =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as FaqFieldError).field === "string" &&
      typeof (item as FaqFieldError).message === "string",
  );
}
