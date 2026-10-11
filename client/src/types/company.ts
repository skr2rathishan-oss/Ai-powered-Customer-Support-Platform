export interface CompanyUserProfile {
  userId: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  roleName: string;
  onlineStatus: string | null;
}

export interface CompanyProfile {
  companyId: number;
  companyName: string;
  industry: string | null;
  businessEmail: string;
  phone: string | null;
  website: string | null;
  description: string | null;
  status: string;
  registrationDate: string | null;
}

export interface CompanyFeatureFlags {
  tickets: boolean;
  agents: boolean;
  faqs: boolean;
  aiSettings: boolean;
}

export interface CompanyOverview {
  openTickets: number;
  resolvedToday: number;
  supportAgents: number;
  faqArticles: number;
  aiConfigured: boolean;
  aiResolutionRate: number | null;
  avgFirstResponseMinutes: number | null;
  features: CompanyFeatureFlags;
}

export interface CompanyMeData {
  user: CompanyUserProfile;
  company: CompanyProfile;
  overview: CompanyOverview;
}

export interface CompanyPortalContext {
  data: CompanyMeData;
  refresh: () => Promise<void>;
  refreshing: boolean;
  refreshError: string | null;
}
