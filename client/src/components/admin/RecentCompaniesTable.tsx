import type { RecentCompany } from "../../services/admin";

interface RecentCompaniesTableProps {
  companies: RecentCompany[];
}

export function RecentCompaniesTable({ companies }: RecentCompaniesTableProps) {
  return (
    <section className="bg-white rounded-2xl border border-[#e2e4e9] overflow-hidden shadow-2xs">
      {/* Header */}
      <div className="p-6 border-b border-[#e2e4e9] flex items-center justify-between bg-[#f6f2ff]/30">
        <div>
          <h3 className="font-bold text-base text-[#1c1b23] tracking-tight">
            Recent Registrations
          </h3>
          <p className="text-xs text-[#787586] mt-0.5">
            Latest enterprise registrations in the platform
          </p>
        </div>
        <button
          type="button"
          className="text-[#6D5EF5] font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-[#6D5EF5]/10 transition-all cursor-pointer"
        >
          View All
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#f8f9fc] border-b border-[#e2e4e9]">
            <tr>
              <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-[#787586]">
                Company
              </th>
              <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-[#787586]">
                Industry
              </th>
              <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-[#787586]">
                Date Joined
              </th>
              <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-[#787586]">
                Status
              </th>
              <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-[#787586] text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e4e9]/60">
            {companies.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-xs text-[#787586]">
                  No registered companies found.
                </td>
              </tr>
            ) : (
              companies.map((company, index) => {
                const initial = (company.companyName || "C").charAt(0).toUpperCase();
                const avatarColors = [
                  "bg-blue-50 text-blue-600",
                  "bg-purple-50 text-purple-600",
                  "bg-emerald-50 text-emerald-600",
                  "bg-amber-50 text-amber-600",
                  "bg-rose-50 text-rose-600",
                ];
                const avatarClass = avatarColors[index % avatarColors.length];

                return (
                  <tr
                    key={company.companyId}
                    className="hover:bg-[#f6f2ff]/40 transition-colors group cursor-pointer"
                  >
                    {/* Company */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-9 h-9 rounded-xl ${avatarClass} flex items-center justify-center font-bold text-xs shadow-2xs border border-white`}
                        >
                          {initial}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-[#1c1b23] group-hover:text-[#6D5EF5] transition-colors leading-tight">
                            {company.companyName}
                          </p>
                          <p className="text-[11px] text-[#787586] mt-0.5">
                            {company.websiteUrl || company.businessEmail}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Industry */}
                    <td className="px-6 py-4">
                      <span className="text-xs text-[#474555] font-medium">
                        {company.industry || "Enterprise"}
                      </span>
                    </td>

                    {/* Date Joined */}
                    <td className="px-6 py-4">
                      <span className="text-xs text-[#474555] font-medium font-mono">
                        {new Date(company.registrationDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {company.status === "Active" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : company.status === "Pending" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px] uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {company.status}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#787586] hover:text-[#6D5EF5] hover:bg-[#6D5EF5]/10 transition-all cursor-pointer"
                        title="Options"
                      >
                        <span className="material-symbols-outlined text-lg">
                          more_horiz
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

