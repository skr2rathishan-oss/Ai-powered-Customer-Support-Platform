import { useCallback, useEffect, useState } from "react";
import { AdminRouteGuard } from "../../components/admin/AdminRouteGuard";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { StatsGrid } from "../../components/admin/StatsGrid";
import { GrowthChart } from "../../components/admin/GrowthChart";
import { DistributionDonut } from "../../components/admin/DistributionDonut";
import { RecentCompaniesTable } from "../../components/admin/RecentCompaniesTable";
import { OnboardCompanyModal } from "../../components/admin/companies/OnboardCompanyModal";
import {
  fetchAdminDashboard,
  type CompanyDetailData,
  type DashboardOverviewData,
} from "../../services/admin";

export function PlatformAdminDashboardPage() {
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState("12months");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = useCallback(async (selectedTimeframe: string, isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const overview = await fetchAdminDashboard(selectedTimeframe);
      setData(overview);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to connect to Platform Admin services.",
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(timeframe);
  }, [timeframe, loadData]);

  function handleTimeframeChange(newTf: string) {
    setTimeframe(newTf);
  }

  function handleOnboarded(company: CompanyDetailData) {
    setOnboardOpen(false);
    setToastMessage(`${company.companyName} onboarded successfully.`);
    setTimeout(() => setToastMessage(null), 4000);
    loadData(timeframe, true);
  }

  function handleExportReport() {
    if (!data) return;
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonStr);
    downloadAnchor.setAttribute("download", `supportpilot-platform-report-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  return (
    <AdminRouteGuard>
      <AdminLayout
        healthItems={data?.health}
        activities={data?.activities}
        onRefresh={() => loadData(timeframe, true)}
        isRefreshing={isRefreshing}
      >
        {loading && !data ? (
          <div className="space-y-8 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-2">
                <div className="h-8 w-64 bg-slate-200 rounded-lg" />
                <div className="h-4 w-96 bg-slate-200 rounded-lg" />
              </div>
              <div className="flex gap-3">
                <div className="h-9 w-32 bg-slate-200 rounded-lg" />
                <div className="h-9 w-36 bg-slate-200 rounded-lg" />
              </div>
            </div>

            {/* 8 Stats Grid Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 p-5" />
              ))}
            </div>

            {/* Charts Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-72 bg-white rounded-2xl border border-slate-200" />
              <div className="h-72 bg-white rounded-2xl border border-slate-200" />
            </div>
          </div>
        ) : error && !data ? (
          <div className="p-8 rounded-2xl bg-white border border-rose-200 shadow-sm flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-2xl">error_outline</span>
            </div>
            <h3 className="font-bold text-lg text-on-surface mb-1">
              Failed to load Platform Overview
            </h3>
            <p className="text-xs text-outline mb-6 max-w-md">{error}</p>
            <button
              type="button"
              onClick={() => loadData(timeframe)}
              className="py-2.5 px-6 rounded-xl bg-[#6D5EF5] text-white text-xs font-bold shadow-sm hover:bg-[#6D5EF5]/90 transition-all cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : data ? (
          <div>
            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-bold text-[#6D5EF5] mb-1 tracking-tight font-display">
                  Platform Overview
                </h2>
                <p className="text-xs text-[#787586]">
                  Monitor your platform performance and enterprise operations in real time.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportReport}
                  className="flex items-center gap-2 bg-white border border-[#e2e4e9] text-[#474555] px-4 py-2 rounded-xl font-bold text-xs hover:bg-[#f6f2ff] hover:border-[#6D5EF5]/30 transition-all shadow-2xs whitespace-nowrap group cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">
                    download
                  </span>
                  Download Report
                </button>
                <button
                  type="button"
                  onClick={() => setOnboardOpen(true)}
                  className="flex items-center gap-2 bg-[#6D5EF5] text-white px-4 py-2 rounded-xl font-bold text-xs hover:shadow-lg hover:shadow-[#6D5EF5]/20 hover:-translate-y-0.5 transition-all active:scale-95 whitespace-nowrap group shadow-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] group-hover:rotate-12 transition-transform">
                    add
                  </span>
                  Onboard Company
                </button>
              </div>
            </header>

            {/* 1. 8 Stats Cards Grid */}
            <StatsGrid stats={data.stats} />

            {/* 2. Charts Section (Growth Chart + Donut) */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <GrowthChart
                trends={data.growthTrends}
                timeframe={timeframe}
                onTimeframeChange={handleTimeframeChange}
              />
              <DistributionDonut stats={data.stats} />
            </section>

            {/* 3. Recent Registrations Table */}
            <RecentCompaniesTable companies={data.recentCompanies} />
          </div>
        ) : null}

        {toastMessage && (
          <div className="fixed bottom-6 right-24 z-50 bg-[#1c1b23] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-fadeIn">
            <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
            {toastMessage}
          </div>
        )}

        <OnboardCompanyModal
          open={onboardOpen}
          onClose={() => setOnboardOpen(false)}
          onOnboarded={handleOnboarded}
        />
      </AdminLayout>
    </AdminRouteGuard>
  );
}

