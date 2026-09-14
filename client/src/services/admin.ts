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
  } catch (error: any) {
    if (error?.status === 401) {
      throw new Error("Authentication required. Please sign in as Platform Admin.");
    }
    if (error?.status === 403) {
      throw new Error("Forbidden: This dashboard requires Platform Administrator privileges.");
    }
    throw new Error(error?.message || "Failed to load platform dashboard data. Please try again.");
  }
}

