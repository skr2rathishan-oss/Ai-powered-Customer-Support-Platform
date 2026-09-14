import { apiRequest } from "./apiClient";

export interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  pendingCompanies: number;
  activePercentage: number;
  pendingPercentage: number;
  suspendedPercentage: number;
  totalUsers: number;
  companyAdmins: number;
  supportAgents: number;
  monthlyGrowth: string;
}

export interface GrowthTrend {
  key: string;
  month: string;
  count: number;
  heightPercentage: number;
}

export interface RecentCompany {
  companyId: number;
  companyName: string;
  industry: string;
  businessEmail: string;
  websiteUrl: string | null;
  status: "Active" | "Pending" | "Suspended" | "Inactive" | "Rejected";
  registrationDate: string;
}

export interface PlatformActivity {
  id: string | number;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

export interface PlatformHealthItem {
  id: string;
  name: string;
  status: "HEALTHY" | "ONLINE" | "CONNECTED" | "RUNNING" | "DEGRADED";
  active: boolean;
}

export interface DashboardOverviewData {
  stats: PlatformStats;
  growthTrends: GrowthTrend[];
  recentCompanies: RecentCompany[];
  activities: PlatformActivity[];
  health: PlatformHealthItem[];
  timestamp: string;
}

export interface CompanyUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  onlineStatus: string;
  accountStatus: string;
  roleName: string;
  createdAt: string;
}

export interface CompanyDirectoryItem {
  companyId: number;
  companyName: string;
  industry: string;
  businessEmail: string;
  companyPhone?: string;
  websiteUrl: string | null;
  description?: string;
  status: "Active" | "Pending" | "Suspended" | "Inactive" | "Rejected";
  registrationDate: string;
  adminId?: number;
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
  totalUsers?: number;
}

export interface CompanyCounts {
  total: number;
  active: number;
  pending: number;
  suspended: number;
}

export interface CompanyDirectoryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CompanyDirectoryResponse {
  companies: CompanyDirectoryItem[];
  counts: CompanyCounts;
  pagination: CompanyDirectoryPagination;
}

export interface CompanyDetailData extends CompanyDirectoryItem {
  users: CompanyUser[];
}

export interface PlatformSettingsGeneral {
  platformName: string;
  supportEmail: string;
  defaultCompanyStatus: "Active" | "Pending";
  timezone: string;
  allowSelfRegistration: boolean;
  platformNotice: string;
}

export interface PlatformSettingsSecurity {
  jwtExpiresIn: string;
  minPasswordLength: number;
  requireSpecialChar: boolean;
  googleOAuthEnabled: boolean;
  cookieSameSite: string;
  cookieSecure: boolean;
  sessionIdleTimeoutMinutes: number;
}

export interface PlatformSettingsEmail {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  senderName: string;
  requireTls: boolean;
  status: string;
}

export interface PlatformSettingsAi {
  defaultModel: string;
  availableModels: string[];
  temperature: number;
  maxOutputTokens: number;
  tokenQuotaPerTenantMonth: number;
  sentimentAnalysisEnabled: boolean;
  autoTicketCategorization: boolean;
}

export interface PlatformSettingsInfrastructure {
  environment: string;
  region: string;
  databaseHost: string;
  maintenanceMode: boolean;
}

export interface PlatformSettingsData {
  general: PlatformSettingsGeneral;
  security: PlatformSettingsSecurity;
  email: PlatformSettingsEmail;
  aiEngine: PlatformSettingsAi;
  infrastructure: PlatformSettingsInfrastructure;
  timestamp: string;
}

export interface SystemDiagnosticsData {
  status: "OPTIMAL" | "DEGRADED" | "OFFLINE";
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  memoryUsage: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  databases: {
    mysql: {
      status: string;
      latencyMs: number;
      pool: {
        total: number;
        active: number;
        idle: number;
      };
    };
    mongodb: {
      status: string;
      databaseName: string;
    };
  };
  timestamp: string;
}

export async function fetchAdminDashboard(
  timeframe = "12months",
): Promise<DashboardOverviewData> {
  try {
    const payload = await apiRequest<{ success: boolean; data: DashboardOverviewData }>(
      `/api/admin/dashboard?timeframe=${encodeURIComponent(timeframe)}`,
      {
        method: "GET",
      },
    );
    return payload.data;
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err?.status === 401) {
      throw new Error("Authentication required. Please sign in as Platform Admin.");
    }
    if (err?.status === 403) {
      throw new Error("Forbidden: This dashboard requires Platform Administrator privileges.");
    }
    throw new Error(err?.message || "Failed to load platform dashboard data. Please try again.");
  }
}

export async function fetchCompaniesDirectory(params: {
  search?: string;
  status?: string;
  industry?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
} = {}): Promise<CompanyDirectoryResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.industry && params.industry !== "all") query.set("industry", params.industry);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const endpoint = `/api/admin/companies${query.toString() ? `?${query.toString()}` : ""}`;
  const payload = await apiRequest<{ success: boolean; data: CompanyDirectoryResponse }>(
    endpoint,
    { method: "GET" },
  );
  return payload.data;
}

export async function fetchCompanyDetail(companyId: number | string): Promise<CompanyDetailData> {
  const payload = await apiRequest<{ success: boolean; data: CompanyDetailData }>(
    `/api/admin/companies/${companyId}`,
    { method: "GET" },
  );
  return payload.data;
}

export async function updateCompanyStatus(
  companyId: number | string,
  status: "Active" | "Pending" | "Suspended" | "Inactive" | "Rejected",
): Promise<CompanyDetailData> {
  const payload = await apiRequest<{ success: boolean; data: CompanyDetailData }>(
    `/api/admin/companies/${companyId}/status`,
    {
      method: "PATCH",
      data: { status },
    },
  );
  return payload.data;
}

export async function deleteCompany(companyId: number | string): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/admin/companies/${companyId}`,
    { method: "DELETE" },
  );
}

export async function fetchPlatformSettings(): Promise<PlatformSettingsData> {
  const payload = await apiRequest<{ success: boolean; data: PlatformSettingsData }>(
    "/api/admin/settings",
    { method: "GET" },
  );
  return payload.data;
}

export async function savePlatformSettings(
  patch: Partial<PlatformSettingsData>,
): Promise<{ success: boolean; message: string; settings: PlatformSettingsData }> {
  return apiRequest<{ success: boolean; message: string; settings: PlatformSettingsData }>(
    "/api/admin/settings",
    {
      method: "PUT",
      data: patch,
    },
  );
}

export async function triggerDiagnosticTestEmail(
  email: string,
): Promise<{ success: boolean; message: string; messageId: string }> {
  return apiRequest<{ success: boolean; message: string; messageId: string }>(
    "/api/admin/settings/test-email",
    {
      method: "POST",
      data: { email },
    },
  );
}

export async function fetchSystemDiagnostics(): Promise<SystemDiagnosticsData> {
  const payload = await apiRequest<{ success: boolean; data: SystemDiagnosticsData }>(
    "/api/admin/diagnostics",
    { method: "GET" },
  );
  return payload.data;
}


