import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { AdminRouteGuard } from "../../components/admin/AdminRouteGuard";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { CompaniesStatsHeader } from "../../components/admin/companies/CompaniesStatsHeader";
import { CompaniesFilters } from "../../components/admin/companies/CompaniesFilters";
import { CompaniesTable } from "../../components/admin/companies/CompaniesTable";
import { CompanyDetailModal } from "../../components/admin/companies/CompanyDetailModal";
import {
  fetchCompaniesDirectory,
  updateCompanyStatus,
  deleteCompany,
  type CompanyDirectoryItem,
  type CompanyCounts,
  type CompanyDirectoryPagination,
} from "../../services/admin";

export function PlatformCompaniesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const initialStatus = searchParams.get("status") || "all";
  const initialIndustry = searchParams.get("industry") || "all";

  const [companies, setCompanies] = useState<CompanyDirectoryItem[]>([]);
  const [counts, setCounts] = useState<CompanyCounts>({ total: 0, active: 0, pending: 0, suspended: 0 });
  const [pagination, setPagination] = useState<CompanyDirectoryPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [industry, setIndustry] = useState(initialIndustry);
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchCompaniesDirectory({
        search,
        status,
        industry,
        sortBy,
        page,
        limit: 10,
      });

      setCompanies(response.companies);
      setCounts(response.counts);
      setPagination(response.pagination);
    } catch (_err) {
      showToast("Failed to load companies directory.");
    } finally {
      setLoading(false);
    }
  }, [search, status, industry, sortBy, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep URL query params in sync
  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (status !== "all") params.status = status;
    if (industry !== "all") params.industry = industry;
    setSearchParams(params, { replace: true });
  }, [search, status, industry, setSearchParams]);

  async function handleStatusChange(
    companyId: number,
    newStatus: "Active" | "Pending" | "Suspended" | "Inactive" | "Rejected",
  ) {
    try {
      await updateCompanyStatus(companyId, newStatus);
      showToast(`Company #${companyId} status changed to ${newStatus}.`);
      loadData();
    } catch (_err) {
      showToast("Failed to update status. Please try again.");
    }
  }

  async function handleDeleteCompany(companyId: number) {
    if (!window.confirm(`Are you sure you want to delete company #${companyId}? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteCompany(companyId);
      showToast(`Company #${companyId} successfully deleted.`);
      loadData();
    } catch (_err) {
      showToast("Failed to delete company.");
    }
  }

  function handleExportCsv() {
    if (companies.length === 0) return;
    const headers = ["Company ID", "Company Name", "Industry", "Email", "Phone", "Status", "Joined"];
    const rows = companies.map((c) => [
      c.companyId,
      `"${c.companyName}"`,
      `"${c.industry}"`,
      c.businessEmail,
      c.companyPhone || "",
      c.status,
      c.registrationDate,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `supportpilot-companies-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <AdminRouteGuard>
      <AdminLayout>
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-24 z-50 bg-[#1c1b23] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-fadeIn">
            <span className="material-symbols-outlined text-emerald-400 text-base">info</span>
            {toastMessage}
          </div>
        )}

        <div className="space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#6D5EF5] uppercase tracking-wider mb-1">
                <span className="material-symbols-outlined text-sm">domain</span>
                Directory Administration
              </div>
              <h1 className="text-2xl font-bold text-[#1c1b23] tracking-tight">
                Enterprise Companies
              </h1>
              <p className="text-xs text-[#787586] mt-0.5">
                Manage registered tenants, verify organizations, and audit access permissions.
              </p>
            </div>
          </div>

          {/* 4 KPI Summary Cards */}
          <CompaniesStatsHeader counts={counts} totalListed={pagination.total} />

          {/* Filters & Search Toolbar */}
          <CompaniesFilters
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            status={status}
            onStatusChange={(val) => {
              setStatus(val);
              setPage(1);
            }}
            industry={industry}
            onIndustryChange={(val) => {
              setIndustry(val);
              setPage(1);
            }}
            sortBy={sortBy}
            onSortChange={(val) => setSortBy(val)}
            onExport={handleExportCsv}
          />

          {/* Companies Data Table */}
          <CompaniesTable
            companies={companies}
            pagination={pagination}
            onPageChange={(newPage) => setPage(newPage)}
            onViewDetails={(company) => setSelectedCompanyId(company.companyId)}
            onStatusChange={handleStatusChange}
            onDeleteCompany={handleDeleteCompany}
            loading={loading}
          />
        </div>

        {/* Company Detail Drawer / Modal */}
        <CompanyDetailModal
          companyId={selectedCompanyId}
          onClose={() => setSelectedCompanyId(null)}
          onStatusChange={handleStatusChange}
        />
      </AdminLayout>
    </AdminRouteGuard>
  );
}

