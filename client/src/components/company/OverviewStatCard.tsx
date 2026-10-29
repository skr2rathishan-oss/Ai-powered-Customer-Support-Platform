interface OverviewStatCardProps {
  label: string;
  value: number | string | null;
  icon: string;
  hint?: string;
}

export function OverviewStatCard({ label, value, icon, hint }: OverviewStatCardProps) {
  return (
    <div className="bg-white border border-[#e2e4e9] rounded-2xl p-5 shadow-2xs">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#787586]">
          {label}
        </p>
        <div className="w-9 h-9 rounded-xl bg-[#6D5EF5]/10 text-[#6D5EF5] flex items-center justify-center">
          <span className="material-symbols-outlined text-xl" aria-hidden="true">
            {icon}
          </span>
        </div>
      </div>
      <p className="text-3xl font-bold text-[#1c1b23] tracking-tight">
        {value === null || value === undefined ? "—" : value}
      </p>
      {hint ? <p className="text-xs text-[#787586] mt-1.5">{hint}</p> : null}
    </div>
  );
}
