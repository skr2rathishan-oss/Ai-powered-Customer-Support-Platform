import type { TicketStatusCounts } from "../../types/tickets";

const SEGMENTS: { key: keyof Omit<TicketStatusCounts, "total">; label: string; color: string }[] = [
  { key: "open", label: "Open", color: "bg-sky-500" },
  { key: "inProgress", label: "In Progress", color: "bg-amber-400" },
  { key: "resolved", label: "Resolved", color: "bg-emerald-500" },
  { key: "closed", label: "Closed", color: "bg-slate-400" },
];

/** Stacked bar plus legend showing how tickets are spread across statuses. */
export function StatusBreakdown({ counts }: { counts: TicketStatusCounts }) {
  const total = counts.total;

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-[#1c1b23] tracking-tight">{total}</span>
        <span className="text-xs text-[#787586]">tickets in total</span>
      </div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-[#f1eff8]"
        role="img"
        aria-label={SEGMENTS.map((s) => `${s.label}: ${counts[s.key]}`).join(", ")}
      >
        {total > 0
          ? SEGMENTS.map((segment) =>
              counts[segment.key] > 0 ? (
                <div
                  key={segment.key}
                  className={segment.color}
                  style={{ width: `${(counts[segment.key] / total) * 100}%` }}
                />
              ) : null,
            )
          : null}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3 mt-5">
        {SEGMENTS.map((segment) => (
          <li key={segment.key} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-[#474555]">
              <span className={`w-2.5 h-2.5 rounded-full ${segment.color}`} aria-hidden="true" />
              {segment.label}
            </span>
            <span className="font-bold text-[#1c1b23]">{counts[segment.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
