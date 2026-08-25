export interface DemoRequestPayload {
  name: string;
  email: string;
  companyName: string;
  teamSize?: string;
  preferredDate?: string;
  note?: string;
}

export interface ContactSalesPayload {
  name: string;
  email: string;
  companyName: string;
  phone?: string;
  requirements?: string;
}

export interface NewsletterPayload {
  email: string;
}

export interface LeadResponse {
  success: boolean;
  message: string;
  data?: {
    id?: string;
    createdAt?: string;
  };
}

