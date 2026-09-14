import type { PlatformStats } from "../../services/admin";

interface DistributionDonutProps {
  stats: PlatformStats;
}

export function DistributionDonut({ stats }: DistributionDonutProps) {
  const activePct = stats.activePercentage || 0;
  const pendingPct = stats.pendingPercentage || 0;
  const suspendedPct = stats.suspendedPercentage || 0;

  // Compute stroke dasharray for SVG donut (circumference = 2 * PI * 40 ≈ 251.32)
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const activeStroke = (activePct / 100) * circumference;
  const pendingStroke = (pendingPct / 100) * circumference;
  const suspendedStroke = (suspendedPct / 100) * circumference;

  return (
    <div className="bg-white border border-[#e2e4e9] rounded-2xl p-6 flex flex-col justify-between shadow-2xs">
      <div>
        <h3 className="font-bold text-base text-[#1c1b23] tracking-tight">
          Distribution
        </h3>
        <p className="text-xs text-[#787586] mt-0.5 mb-4">
          Entity status breakdown
        </p>
      </div>

      {/* SVG Donut */}
      <div className="flex items-center justify-center relative my-2">
        <svg className="w-44 h-44 -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="#f0ecf9"
            strokeWidth="14"
          />
          {/* Active Segment (#6D5EF5) */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="#6D5EF5"
            strokeWidth="14"
            strokeDasharray={`${activeStroke} ${circumference - activeStroke}`}
            strokeDashoffset="0"
          />
          {/* Pending Segment (#fbbf24) */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="#fbbf24"
            strokeWidth="14"
            strokeDasharray={`${pendingStroke} ${circumference - pendingStroke}`}
            strokeDashoffset={`-${activeStroke}`}
          />
          {/* Suspended Segment (#f43f5e) */}
          {suspendedStroke > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#f43f5e"
              strokeWidth="14"
              strokeDasharray={`${suspendedStroke} ${circumference - suspendedStroke}`}
              strokeDashoffset={`-${activeStroke + pendingStroke}`}
            />
          )}
        </svg>

        {/* Center count label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-2xl font-bold text-[#1c1b23] tracking-tight">
            {stats.totalCompanies.toLocaleString()}
          </p>
          <p className="text-[9px] font-bold text-[#787586] uppercase tracking-widest mt-0.5">
            Total
          </p>
        </div>
      </div>

      {/* Legend & Breakdown */}
      <div className="space-y-2 mt-4">
        {/* Active */}
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#f6f2ff] transition-all cursor-default">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6D5EF5] shadow-xs shadow-[#6D5EF5]/40" />
            <span className="text-xs font-bold text-[#474555]">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#1c1b23]">
              {stats.activeCompanies}
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              {activePct}%
            </span>
          </div>
        </div>

        {/* Pending */}
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#f6f2ff] transition-all cursor-default">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-xs shadow-amber-400/40" />
            <span className="text-xs font-bold text-[#474555]">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#1c1b23]">
              {stats.pendingCompanies}
            </span>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              {pendingPct}%
            </span>
          </div>
        </div>

        {/* Suspended */}
        {stats.suspendedCompanies > 0 && (
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#f6f2ff] transition-all cursor-default">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs shadow-rose-500/40" />
              <span className="text-xs font-bold text-[#474555]">Suspended</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#1c1b23]">
                {stats.suspendedCompanies}
              </span>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                {suspendedPct}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

