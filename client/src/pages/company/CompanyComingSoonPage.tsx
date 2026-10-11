import { Link } from "react-router";
import { useCompanyPortal } from "../../components/company/useCompanyPortal";
import { ROUTES } from "../../router/routes";

interface CompanyComingSoonPageProps {
  title: string;
  description: string;
  icon: string;
}

export function CompanyComingSoonPage({
  title,
  description,
  icon,
}: CompanyComingSoonPageProps) {
  useCompanyPortal();

  return (
    <section className="bg-white border border-[#e2e4e9] rounded-2xl p-10 text-center shadow-2xs">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-[#6D5EF5]/10 text-[#6D5EF5] flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl" aria-hidden="true">
          {icon}
        </span>
      </div>
      <h2 className="text-2xl font-bold text-[#1c1b23] mb-2">{title}</h2>
      <p className="text-sm text-[#474555] max-w-md mx-auto mb-6">{description}</p>
      <p className="inline-block px-3 py-1 rounded-full bg-[#f6f2ff] text-[#6D5EF5] text-[11px] font-bold uppercase tracking-wider mb-6">
        Coming soon
      </p>
      <div>
        <Link
          to={ROUTES.DASHBOARD_COMPANY}
          className="inline-flex px-5 py-2.5 rounded-xl border border-[#e2e4e9] text-sm font-semibold text-[#474555] hover:bg-[#f6f2ff] no-underline"
        >
          Back to overview
        </Link>
      </div>
    </section>
  );
}
