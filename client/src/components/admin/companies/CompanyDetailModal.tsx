import { useEffect, useState } from "react";
import { fetchCompanyDetail, type CompanyDetailData } from "../../../services/admin";

interface CompanyDetailModalProps {
  companyId: number | null;
  onClose: () => void;
  onStatusChange: (companyId: number, newStatus: "Active" | "Pending" | "Suspended" | "Inactive" | "Rejected") => void;
}

export function CompanyDetailModal({
  companyId,
  onClose,
  onStatusChange,
}: CompanyDetailModalProps) {
  const [data, setData] = useState<CompanyDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadDetail = (id: number) => {
    setLoading(true);
    setError(null);
    fetchCompanyDetail(id)
      .then((detail) => {
        setData(detail);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load company details. Please try again.",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!companyId) {
      setData(null);
      setError(null);
      return;
    }
    loadDetail(companyId);
  }, [companyId]);

  if (!companyId) return null;

  async function handleStatusUpdate(newStatus: "Active" | "Pending" | "Suspended" | "Inactive" | "Rejected") {
    if (!companyId) return;
    setUpdating(true);
    try {
      await onStatusChange(companyId, newStatus);
      if (data) {
        setData({ ...data, status: newStatus });
      }
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-white border border-[#e2e4e9] rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#e2e4e9] flex items-center justify-between bg-[#fbfbfe]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#6D5EF5] text-white font-bold flex items-center justify-center text-sm shadow-md shadow-[#6D5EF5]/20">
              {data?.companyName?.slice(0, 2).toUpperCase() || "CO"}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1c1b23] leading-tight">
                {loading ? "Loading Company…" : data?.companyName}
              </h2>
              <p className="text-xs text-[#787586] mt-0.5">
                Enterprise ID: #{companyId} • {data?.industry || "Enterprise Tenant"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-[#787586] hover:text-[#1c1b23] flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-[#474555]">
          {loading ? (
            <div className="space-y-4 py-8 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
              <div className="h-20 bg-slate-200 rounded" />
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
              <span className="material-symbols-outlined text-3xl text-rose-500">error</span>
              <p className="font-semibold text-rose-800 text-sm">{error}</p>
              <button
                type="button"
                onClick={() => companyId && loadDetail(companyId)}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
              >
                Retry
              </button>
            </div>
          ) : data ? (
            <>
              {/* Status Switcher Bar */}
              <div className="p-4 rounded-2xl bg-[#f6f2ff]/60 border border-[#e2e4e9] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-[#787586] uppercase tracking-wider">
                    Current Status
                  </p>
                  <p className="font-bold text-sm text-[#1c1b23] mt-0.5">{data.status}</p>
                </div>
                <div className="flex items-center gap-2">
                  {data.status !== "Active" && (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleStatusUpdate("Active")}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      Activate Tenant
                    </button>
                  )}
                  {data.status !== "Suspended" && (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleStatusUpdate("Suspended")}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      Suspend Access
                    </button>
                  )}
                </div>
              </div>

              {/* General Enterprise Profile */}
              <div>
                <h3 className="font-bold text-xs text-[#1c1b23] uppercase tracking-wider mb-3">
                  Enterprise Overview
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#fbfbfe] p-4 rounded-2xl border border-[#e2e4e9]">
                  <div>
                    <span className="text-[#787586] block text-[11px]">Business Email</span>
                    <span className="font-semibold text-[#1c1b23]">{data.businessEmail}</span>
                  </div>
                  <div>
                    <span className="text-[#787586] block text-[11px]">Phone</span>
                    <span className="font-semibold text-[#1c1b23]">
                      {data.companyPhone || "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#787586] block text-[11px]">Website</span>
                    {data.websiteUrl ? (
                      <a
                        href={data.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#6D5EF5] hover:underline"
                      >
                        {data.websiteUrl}
                      </a>
                    ) : (
                      <span className="text-[#787586]">None</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[#787586] block text-[11px]">Joined Platform</span>
                    <span className="font-semibold text-[#1c1b23]">
                      {new Date(data.registrationDate).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </div>
                {data.description && (
                  <p className="mt-3 text-xs text-[#787586] italic bg-white p-3 rounded-xl border border-[#e2e4e9]/80">
                    "{data.description}"
                  </p>
                )}
              </div>

              {/* Associated Users */}
              <div>
                <h3 className="font-bold text-xs text-[#1c1b23] uppercase tracking-wider mb-3">
                  Associated Users ({data.users?.length || 0})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(!data.users || data.users.length === 0) ? (
                    <p className="text-[#787586] italic py-2">No user accounts attached yet.</p>
                  ) : (
                    data.users.map((u) => (
                      <div
                        key={u.userId}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#fbfbfe] border border-[#e2e4e9]"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                            {u.firstName?.[0] || "U"}
                          </div>
                          <div>
                            <p className="font-semibold text-[#1c1b23]">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-[10px] text-[#787586]">{u.email}</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#f6f2ff] text-[#6D5EF5]">
                          {u.roleName}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#e2e4e9] bg-[#fbfbfe] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white border border-[#e2e4e9] font-bold text-xs text-[#474555] hover:bg-[#f6f2ff] hover:text-[#1c1b23] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

