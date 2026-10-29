import type { TicketPagination } from "../../../types/tickets";

interface TicketsPaginationProps {
  pagination: TicketPagination;
  onPageChange: (page: number) => void;
}

export function TicketsPagination({
  pagination,
  onPageChange,
}: TicketsPaginationProps) {
  const { page, limit, total, totalPages } = pagination;
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const buttonClass =
    "px-3 py-1.5 rounded-lg border border-[#e2e4e9] bg-white text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30";

  return (
    <nav
      aria-label="Tickets pagination"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#e2e4e9] bg-[#fbfbfe] text-xs text-[#787586]"
    >
      <p>
        Showing {from}-{to} of {total}
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={buttonClass}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="font-semibold text-[#1c1b23]">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          className={buttonClass}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
