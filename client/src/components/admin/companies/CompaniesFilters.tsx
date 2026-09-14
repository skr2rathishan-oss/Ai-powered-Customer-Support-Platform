import { Link } from "react-router";
import { ROUTES } from "../../../router/routes";

interface CompaniesFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  industry: string;
  onIndustryChange: (val: string) => void;
  sortBy: string;
  onSortChange: (val: string) => void;
  onExport: () => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Pending", label: "Pending" },
  { value: "Suspended", label: "Suspended" },
  { value: "Inactive", label: "Inactive" },
];

const INDUSTRY_OPTIONS = [
  { value: "all", label: "All Industries" },
  { value: "Technology", label: "Technology" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Finance & Banking", label: "Finance & Banking" },
  { value: "E-Commerce", label: "E-Commerce" },
  { value: "Logistics", label: "Logistics" },
  { value: "Education", label: "Education" },
  { value: "Retail", label: "Retail" },
];

export function CompaniesFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  industry,
  onIndustryChange,
  sortBy,
  onSortChange,
  onExport,
}: CompaniesFiltersProps) {
  return (
    <div className="bg-white border border-[#e2e4e9] rounded-2xl p-4 shadow-2xs space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#787586] text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Search by name, email, admin..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-xl py-2 pl-10 pr-4 text-xs text-[#1c1b23] focus:ring-2 focus:ring-[#6D5EF5]/20 focus:border-[#6D5EF5] outline-none transition-all placeholder-[#787586]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={onExport}
            className="px-4 py-2 rounded-xl bg-white border border-[#e2e4e9] text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] hover:text-[#1c1b23] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export CSV
          </button>
          <Link
            to={ROUTES.REGISTER_COMPANY}
            className="px-4 py-2 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-xs font-bold transition-all shadow-md shadow-[#6D5EF5]/20 hover:shadow-lg hover:shadow-[#6D5EF5]/30 flex items-center gap-1.5 no-underline active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">add_business</span>
            Onboard Enterprise
          </Link>
        </div>
      </div>

      {/* Filter controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#e2e4e9]/60">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusChange(opt.value)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                status === opt.value
                  ? "bg-[#6D5EF5] text-white shadow-xs"
                  : "bg-[#f6f2ff]/80 text-[#474555] hover:bg-[#ece6ff] hover:text-[#1c1b23]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Industry & Sort Dropdowns */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs text-[#787586]">
            <span className="material-symbols-outlined text-sm">category</span>
            <select
              value={industry}
              onChange={(e) => onIndustryChange(e.target.value)}
              aria-label="Filter by Industry"
              className="bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-lg py-1 px-2.5 text-xs text-[#1c1b23] outline-none focus:border-[#6D5EF5] cursor-pointer"
            >
              {INDUSTRY_OPTIONS.map((ind) => (
                <option key={ind.value} value={ind.value}>
                  {ind.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#787586]">
            <span className="material-symbols-outlined text-sm">sort</span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              aria-label="Sort Companies"
              className="bg-[#f6f2ff]/60 border border-[#e2e4e9] rounded-lg py-1 px-2.5 text-xs text-[#1c1b23] outline-none focus:border-[#6D5EF5] cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

