import type { CompanyCounts } from "../../../services/admin";

interface CompaniesStatsHeaderProps {
  counts: CompanyCounts;
  totalListed: number;
}

export function CompaniesStatsHeader({ counts }: CompaniesStatsHeaderProps) {
  const activePercent =
    counts.total > 0 ? Math.round((counts.active / counts.total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* 1. Total Enterprises */}
      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-[#787586] uppercase tracking-wider">
            Total Enterprises
          </span>
          <div className="w-8 h-8 rounded-xl bg-[#6D5EF5]/10 text-[#6D5EF5] flex items-center justify-center group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-lg">corporate_fare</span>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#1c1b23] tracking-tight">
            {counts.total.toLocaleString()}
          </span>
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
            Live Database
          </span>
        </div>
        <p className="text-[11px] text-[#787586] mt-2">
          Registered tenants across all regions
        </p>
      </div>

      {/* 2. Active & Verified */}
      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-[#787586] uppercase tracking-wider">
            Active & Verified
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-lg">verified</span>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#1c1b23] tracking-tight">
            {counts.active.toLocaleString()}
          </span>
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
            {activePercent}%
          </span>
        </div>
        <p className="text-[11px] text-[#787586] mt-2">
          Healthy, operational enterprise tenants
        </p>
      </div>

      {/* 3. Pending Approvals */}
      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-[#787586] uppercase tracking-wider">
            Pending Review
          </span>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-lg">pending_actions</span>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#1c1b23] tracking-tight">
            {counts.pending.toLocaleString()}
          </span>
          {counts.pending > 0 && (
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md animate-pulse">
              Requires Action
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#787586] mt-2">
          Awaiting administrative onboarding check
        </p>
      </div>

      {/* 4. Suspended Accounts */}
      <div className="bg-white border border-[#e2e4e9] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-[#787586] uppercase tracking-wider">
            Suspended Tenants
          </span>
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-lg">block</span>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[#1c1b23] tracking-tight">
            {counts.suspended.toLocaleString()}
          </span>
          <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
            Restricted
          </span>
        </div>
        <p className="text-[11px] text-[#787586] mt-2">
          Access blocked or under compliance review
        </p>
      </div>
    </div>
  );
}

