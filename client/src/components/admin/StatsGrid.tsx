import type { PlatformStats } from "../../services/admin";

interface StatsGridProps {
  stats: PlatformStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* 1. Total Companies */}
      <div className="bg-white/80 backdrop-blur-md border border-[#e2e4e9] rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300 group shadow-2xs">
        <div className="flex justify-between items-start mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#6D5EF5]/10 flex items-center justify-center text-[#6D5EF5] group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">business</span>
          </div>
          <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            +12%
          </span>
        </div>
        <h4 className="text-[24px] font-bold text-[#1c1b23] tracking-tight">
          {stats.totalCompanies.toLocaleString()}
        </h4>
        <p className="text-[10px] font-bold text-[#787586] uppercase tracking-wider mt-0.5">
          Total Companies
        </p>
      </div>

      {/* 2. Active Companies */}
      <div className="bg-white/80 backdrop-blur-md border border-[#e2e4e9] rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300 group shadow-2xs">
        <div className="flex justify-between items-start mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
          <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            {stats.activePercentage}%
          </span>
        </div>
        <h4 className="text-[24px] font-bold text-[#1c1b23] tracking-tight">
          {stats.activeCompanies.toLocaleString()}
        </h4>
        <p className="text-[10px] font-bold text-[#787586] uppercase tracking-wider mt-0.5">
          Active Companies
        </p>
      </div>

      {/* 3. Suspended */}
      <div className="bg-white/80 backdrop-blur-md border border-[#e2e4e9] rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300 group shadow-2xs">
        <div className="flex justify-between items-start mb-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">block</span>
          </div>
          <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            {stats.suspendedCompanies}
          </span>
        </div>
        <h4 className="text-[24px] font-bold text-[#1c1b23] tracking-tight">
          {stats.suspendedCompanies.toLocaleString()}
        </h4>
        <p className="text-[10px] font-bold text-[#787586] uppercase tracking-wider mt-0.5">
          Suspended
        </p>
      </div>

      {/* 4. Pending Approval */}
      <div className="bg-white/80 backdrop-blur-md border border-[#e2e4e9] rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300 group shadow-2xs">
        <div className="flex justify-between items-start mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">pending_actions</span>
          </div>
          <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            {stats.pendingCompanies}
          </span>
        </div>
        <h4 className="text-[24px] font-bold text-[#1c1b23] tracking-tight">
          {stats.pendingCompanies.toLocaleString()}
        </h4>
        <p className="text-[10px] font-bold text-[#787586] uppercase tracking-wider mt-0.5">
          Pending Approval
        </p>
      </div>

      {/* 5. Total Users */}
      <div className="bg-white/80 backdrop-blur-md border border-[#e2e4e9] rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300 group shadow-2xs">
        <div className="flex justify-between items-start mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">group</span>
          </div>
          <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            +8%
          </span>
        </div>
        <h4 className="text-[24px] font-bold text-[#1c1b23] tracking-tight">
          {stats.totalUsers >= 1000
            ? `${(stats.totalUsers / 1000).toFixed(1)}k`
            : stats.totalUsers}
        </h4>
        <p className="text-[10px] font-bold text-[#787586] uppercase tracking-wider mt-0.5">
          Total Users
        </p>
      </div>

      {/* 6. Company Admins */}
      <div className="bg-white/80 backdrop-blur-md border border-[#e2e4e9] rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300 group shadow-2xs">
        <div className="flex justify-between items-start mb-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
          </div>
          <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            {stats.companyAdmins}
          </span>
        </div>
        <h4 className="text-[24px] font-bold text-[#1c1b23] tracking-tight">
          {stats.companyAdmins.toLocaleString()}
        </h4>
        <p className="text-[10px] font-bold text-[#787586] uppercase tracking-wider mt-0.5">
          Company Admins
        </p>
      </div>

      {/* 7. Support Agents */}
      <div className="bg-white/80 backdrop-blur-md border border-[#e2e4e9] rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300 group shadow-2xs">
        <div className="flex justify-between items-start mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#6D5EF5]/10 flex items-center justify-center text-[#6D5EF5] group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">support_agent</span>
          </div>
          <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            +15%
          </span>
        </div>
        <h4 className="text-[24px] font-bold text-[#1c1b23] tracking-tight">
          {stats.supportAgents.toLocaleString()}
        </h4>
        <p className="text-[10px] font-bold text-[#787586] uppercase tracking-wider mt-0.5">
          Support Agents
        </p>
      </div>

      {/* 8. Monthly Growth */}
      <div className="bg-white/80 backdrop-blur-md border border-[#e2e4e9] rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300 group shadow-2xs">
        <div className="flex justify-between items-start mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">trending_up</span>
          </div>
          <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
            Active
          </span>
        </div>
        <h4 className="text-[24px] font-bold text-[#1c1b23] tracking-tight">
          {stats.monthlyGrowth}
        </h4>
        <p className="text-[10px] font-bold text-[#787586] uppercase tracking-wider mt-0.5">
          Monthly Growth
        </p>
      </div>
    </section>
  );
}

