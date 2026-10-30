import { useState } from "react";
import type { CompanyDirectoryItem, CompanyDirectoryPagination } from "../../../services/admin";

interface CompaniesTableProps {
  companies: CompanyDirectoryItem[];
  pagination: CompanyDirectoryPagination;
  onPageChange: (newPage: number) => void;
  onViewDetails: (company: CompanyDirectoryItem) => void;
  onStatusChange: (companyId: number, newStatus: "Active" | "Pending" | "Suspended" | "Inactive" | "Rejected") => void;
  onDeleteCompany: (companyId: number) => void;
  loading: boolean;
}

const AVATAR_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-blue-500 to-cyan-600",
  "from-rose-500 to-pink-600",
  "from-purple-500 to-fuchsia-600",
];

export function CompaniesTable({
  companies,
  pagination,
  onPageChange,
  onViewDetails,
  onStatusChange,
  onDeleteCompany,
  loading,
}: CompaniesTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  function getInitials(name: string) {
    if (!name) return "CO";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  function getAvatarColor(id: number) {
    return AVATAR_COLORS[id % AVATAR_COLORS.length];
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        );
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending
          </span>
        );
      case "Suspended":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Suspended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {status}
          </span>
        );
    }
  }

  return (
    <div className="bg-white border border-[#e2e4e9] rounded-2xl shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#e2e4e9] bg-[#fbfbfe] text-[11px] font-bold uppercase tracking-wider text-[#787586]">
              <th className="py-3.5 px-6">Company & Profile</th>
              <th className="py-3.5 px-4">Industry</th>
              <th className="py-3.5 px-4">Administrator</th>
              <th className="py-3.5 px-4">Users</th>
              <th className="py-3.5 px-4">Registered</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e4e9]/70 text-xs text-[#1c1b23]">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-200" />
                      <div className="space-y-1.5">
                        <div className="h-3 w-32 bg-slate-200 rounded" />
                        <div className="h-2.5 w-24 bg-slate-200 rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                  <td className="py-4 px-4"><div className="h-3 w-28 bg-slate-200 rounded" /></td>
                  <td className="py-4 px-4"><div className="h-3 w-8 bg-slate-200 rounded" /></td>
                  <td className="py-4 px-4"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                  <td className="py-4 px-4"><div className="h-4 w-16 bg-slate-200 rounded-full" /></td>
                  <td className="py-4 px-6 text-right"><div className="h-6 w-6 bg-slate-200 rounded ml-auto" /></td>
                </tr>
              ))
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#787586]">
                  <div className="flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
                      domain_disabled
                    </span>
                    <p className="font-semibold text-sm text-[#1c1b23]">No companies found</p>
                    <p className="text-xs text-[#787586] mt-1">Try adjusting your search query or filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr
                  key={company.companyId}
                  className="hover:bg-[#f6f2ff]/40 transition-colors group cursor-default"
                >
                  {/* Company Name & Avatar */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${getAvatarColor(
                          company.companyId,
                        )} flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0`}
                      >
                        {getInitials(company.companyName)}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onViewDetails(company)}
                          className="font-bold text-[#1c1b23] hover:text-[#6D5EF5] transition-colors truncate block text-left cursor-pointer"
                        >
                          {company.companyName}
                        </button>
                        <div className="flex items-center gap-2 text-[11px] text-[#787586] truncate">
                          <span>{company.businessEmail}</span>
                          {company.websiteUrl && (
                            <>
                              <span>•</span>
                              <a
                                href={company.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#6D5EF5] hover:underline inline-flex items-center gap-0.5"
                              >
                                <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                                Web
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Industry */}
                  <td className="py-4 px-4 font-medium text-[#474555]">
                    <span className="px-2 py-0.5 rounded-md bg-[#f6f2ff] text-[#6D5EF5] font-semibold text-[11px]">
                      {company.industry || "General"}
                    </span>
                  </td>

                  {/* Administrator */}
                  <td className="py-4 px-4">
                    {company.adminFirstName ? (
                      <div>
                        <p className="font-semibold text-[#1c1b23] leading-tight">
                          {company.adminFirstName} {company.adminLastName}
                        </p>
                        <p className="text-[10px] text-[#787586]">{company.adminEmail}</p>
                      </div>
                    ) : (
                      <span className="text-[#787586] italic text-[11px]">No Admin</span>
                    )}
                  </td>

                  {/* Users */}
                  <td className="py-4 px-4">
                    <span className="font-semibold text-[#1c1b23] bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                      {company.totalUsers || 1}
                    </span>
                  </td>

                  {/* Registered */}
                  <td className="py-4 px-4 text-[#787586] text-[11px]">
                    {new Date(company.registrationDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>

                  {/* Status */}
                  <td className="py-4 px-4">{getStatusBadge(company.status)}</td>

                  {/* Actions Dropdown */}
                  <td className="py-4 px-6 text-right relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMenuId(
                          activeMenuId === company.companyId ? null : company.companyId,
                        )
                      }
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#787586] hover:text-[#1c1b23] transition-colors ml-auto cursor-pointer"
                      title="Actions"
                    >
                      <span className="material-symbols-outlined text-base">more_vert</span>
                    </button>

                    {activeMenuId === company.companyId && (
                      <div className="absolute right-6 top-12 w-44 bg-white border border-[#e2e4e9] rounded-xl shadow-lg p-1.5 z-30 text-left">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onViewDetails(company);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] hover:text-[#6D5EF5] rounded-lg transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          View Profile
                        </button>
                        {company.status !== "Active" && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onStatusChange(company.companyId, "Active");
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            Activate
                          </button>
                        )}
                        {company.status !== "Suspended" && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onStatusChange(company.companyId, "Suspended");
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">pause_circle</span>
                            Suspend
                          </button>
                        )}
                        <div className="border-t border-[#e2e4e9] my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onDeleteCompany(company.companyId);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Delete Tenant
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="py-3 px-6 bg-[#fbfbfe] border-t border-[#e2e4e9] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#787586]">
        <span>
          Showing{" "}
          <strong className="text-[#1c1b23]">
            {companies.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
          </strong>{" "}
          to{" "}
          <strong className="text-[#1c1b23]">
            {Math.min(pagination.page * pagination.limit, pagination.total)}
          </strong>{" "}
          of <strong className="text-[#1c1b23]">{pagination.total}</strong> companies
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="px-3 py-1 rounded-lg border border-[#e2e4e9] bg-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f6f2ff] hover:text-[#6D5EF5] transition-all cursor-pointer"
          >
            Previous
          </button>
          <span className="px-3 py-1 font-bold text-[#1c1b23]">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="px-3 py-1 rounded-lg border border-[#e2e4e9] bg-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f6f2ff] hover:text-[#6D5EF5] transition-all cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

