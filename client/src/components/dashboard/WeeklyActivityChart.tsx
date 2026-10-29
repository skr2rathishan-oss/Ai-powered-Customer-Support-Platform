interface WeeklyActivityChartProps {
  days: { day: string; total: number }[];
}

function weekdayLabel(day: string): string {
  // Day keys are UTC dates (YYYY-MM-DD); format them in UTC so labels don't shift
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? day
    : date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

/** Bar chart of tickets created per day over the last week. */
export function WeeklyActivityChart({ days }: WeeklyActivityChartProps) {
  const max = Math.max(...days.map((d) => d.total), 1);
  const weekTotal = days.reduce((sum, d) => sum + d.total, 0);

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-5">
        <span className="text-3xl font-bold text-[#1c1b23] tracking-tight">{weekTotal}</span>
        <span className="text-xs text-[#787586]">new tickets in the last 7 days</span>
      </div>
      <div className="flex items-end gap-2 sm:gap-3 h-40" role="list" aria-label="Tickets created per day">
        {days.map((d, index) => {
          const isToday = index === days.length - 1;
          return (
            <div key={d.day} role="listitem" className="flex-1 flex flex-col items-center gap-2 h-full min-w-0">
              <span className="text-[11px] font-bold text-[#474555]">{d.total}</span>
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    isToday ? "bg-[#6D5EF5]" : d.total > 0 ? "bg-[#6D5EF5]/35" : "bg-[#f1eff8]"
                  }`}
                  style={{ height: `${Math.max(6, (d.total / max) * 100)}%` }}
                  title={`${d.day}: ${d.total} ticket${d.total === 1 ? "" : "s"}`}
                />
              </div>
              <span className={`text-[11px] ${isToday ? "font-bold text-[#6D5EF5]" : "text-[#787586]"}`}>
                {isToday ? "Today" : weekdayLabel(d.day)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
