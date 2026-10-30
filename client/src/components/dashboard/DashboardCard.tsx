import { useId, type ReactNode } from "react";
import { Link } from "react-router";

interface DashboardCardProps {
  title: string;
  icon: string;
  action?: { label: string; to: string };
  className?: string;
  children: ReactNode;
}

/** White panel with a titled header, used for every dashboard section. */
export function DashboardCard({ title, icon, action, className = "", children }: DashboardCardProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={`bg-white border border-[#e2e4e9] rounded-2xl p-5 sm:p-6 shadow-2xs min-w-0 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 id={headingId} className="flex items-center gap-2 font-bold text-sm text-[#1c1b23]">
          <span className="material-symbols-outlined text-lg text-[#6D5EF5]" aria-hidden="true">
            {icon}
          </span>
          {title}
        </h2>
        {action ? (
          <Link
            to={action.to}
            className="text-xs font-semibold text-[#6D5EF5] hover:underline no-underline whitespace-nowrap"
          >
            {action.label} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function DashboardEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 text-[#787586]">
      <span className="material-symbols-outlined text-3xl text-[#c9c7d3] mb-2" aria-hidden="true">
        {icon}
      </span>
      <p className="text-xs">{text}</p>
    </div>
  );
}

export function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-5 py-4"
    >
      <span className="flex items-center gap-2">
        <span className="material-symbols-outlined text-lg" aria-hidden="true">
          error
        </span>
        {message}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
      >
        Retry
      </button>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-white border border-[#e2e4e9] rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 bg-white border border-[#e2e4e9] rounded-2xl" />
        <div className="h-64 bg-white border border-[#e2e4e9] rounded-2xl" />
      </div>
    </div>
  );
}
