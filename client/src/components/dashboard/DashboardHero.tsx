import type { ReactNode } from "react";

interface DashboardHeroProps {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}

/** Gradient welcome banner shared by the company, agent and customer dashboards. */
export function DashboardHero({ eyebrow, title, subtitle, children }: DashboardHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#6D5EF5] via-[#7a6cf7] to-[#9b8eff] text-white px-6 py-7 sm:px-8 shadow-lg shadow-[#6D5EF5]/20">
      <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/10" aria-hidden="true" />
      <div className="absolute right-24 -bottom-20 w-40 h-40 rounded-full bg-white/10" aria-hidden="true" />
      <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/75">{eyebrow}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1.5">{title}</h1>
          {subtitle ? <div className="text-sm text-white/85 mt-2">{subtitle}</div> : null}
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2.5">{children}</div> : null}
      </div>
    </section>
  );
}
