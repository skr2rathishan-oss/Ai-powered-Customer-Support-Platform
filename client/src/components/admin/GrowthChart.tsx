import type { GrowthTrend } from "../../services/admin";

interface GrowthChartProps {
  trends: GrowthTrend[];
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
}

export function GrowthChart({
  trends,
  timeframe,
  onTimeframeChange,
}: GrowthChartProps) {
  return (
    <div className="lg:col-span-2 bg-white border border-[#e2e4e9] rounded-2xl p-6 flex flex-col justify-between shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-base text-[#1c1b23] tracking-tight">
            Platform Growth
          </h3>
          <p className="text-xs text-[#787586] mt-0.5">
            Daily company registration volume
          </p>
        </div>
        <div>
          <select
            value={timeframe}
            onChange={(e) => onTimeframeChange(e.target.value)}
            className="bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-lg text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] outline-none cursor-pointer text-[#474555]"
          >
            <option value="12months">Last 12 Months</option>
            <option value="quarter">Last Quarter</option>
          </select>
        </div>
      </div>

      {/* Chart Bars */}
      <div className="h-48 flex items-end justify-between gap-2.5 px-2 pt-4">
        {trends.map((item, index) => {
          // Dynamic gradient intensity based on position and height
          const isLatest = index === trends.length - 1;
          return (
            <div
              key={item.key || index}
              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
            >
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1c1b23] text-white text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-10 whitespace-nowrap">
                {item.count} {item.count === 1 ? "company" : "companies"} ({item.month})
              </div>

              {/* Bar */}
              <div
                style={{ height: `${item.heightPercentage}%` }}
                className={`w-full rounded-t-lg transition-all duration-500 group-hover:scale-y-105 origin-bottom ${
                  isLatest
                    ? "bg-[#6D5EF5] shadow-lg shadow-[#6D5EF5]/30"
                    : index > 8
                    ? "bg-[#6D5EF5]/70 group-hover:bg-[#6D5EF5]/90"
                    : index > 5
                    ? "bg-[#6D5EF5]/40 group-hover:bg-[#6D5EF5]/60"
                    : "bg-[#6D5EF5]/20 group-hover:bg-[#6D5EF5]/35"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* X Axis Labels */}
      <div className="flex justify-between mt-4 text-[10px] font-bold text-[#787586] px-2 uppercase tracking-widest border-t border-[#e2e4e9]/50 pt-2">
        {trends.filter((_, idx) => idx % 2 === 0).map((t) => (
          <span key={t.key}>{t.month}</span>
        ))}
      </div>
    </div>
  );
}

