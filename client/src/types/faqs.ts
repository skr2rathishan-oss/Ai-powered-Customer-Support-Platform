export type FaqStatusFilter = "" | "published" | "draft";

export interface Faq {
  faqId: number;
  question: string;
  answer: string;
  category: string | null;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FaqSummary {
  total: number;
  published: number;
  draft: number;
}

export interface FaqListResult {
  faqs: Faq[];
  categories: string[];
  summary: FaqSummary;
}

export interface FaqFilters {
  search: string;
  category: string;
  status: FaqStatusFilter;
}

export interface FaqInput {
  question?: string;
  answer?: string;
  category?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
}

export interface FaqFieldError {
  field: string;
  message: string;
}
