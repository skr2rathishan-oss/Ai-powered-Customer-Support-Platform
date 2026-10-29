import type { Faq } from "../../../types/faqs";
import { FaqStatusBadge } from "./FaqStatusBadge";

interface FaqListProps {
  faqs: Faq[];
  busyFaqId: number | null;
  rowErrors: Record<number, string>;
  onEdit: (faq: Faq, trigger: HTMLElement) => void;
  onTogglePublish: (faq: Faq) => void;
  onDelete: (faq: Faq, trigger: HTMLElement) => void;
}

const actionClass =
  "px-3 py-1.5 rounded-lg border border-[#e2e4e9] bg-white text-xs font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30";

export function FaqList({
  faqs,
  busyFaqId,
  rowErrors,
  onEdit,
  onTogglePublish,
  onDelete,
}: FaqListProps) {
  return (
    <ul className="divide-y divide-[#e2e4e9]">
      {faqs.map((faq) => {
        const busy = busyFaqId === faq.faqId;
        return (
          <li
            key={faq.faqId}
            data-testid="faq-row"
            aria-label={faq.question}
            className="p-5 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-sm font-bold text-[#1c1b23] min-w-0 break-words">
                {faq.question}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {faq.category ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#f6f2ff] text-[#6D5EF5] border border-[#e2e4e9]">
                    {faq.category}
                  </span>
                ) : null}
                <FaqStatusBadge isPublished={faq.isPublished} />
              </div>
            </div>

            <p className="text-xs text-[#474555] whitespace-pre-wrap break-words line-clamp-3">
              {faq.answer}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-[#787586]">
                Display order {faq.sortOrder}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-label={`Edit "${faq.question}"`}
                  onClick={(event) => onEdit(faq, event.currentTarget)}
                  disabled={busy}
                  className={actionClass}
                >
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`${faq.isPublished ? "Unpublish" : "Publish"} "${faq.question}"`}
                  onClick={() => onTogglePublish(faq)}
                  disabled={busy}
                  className={actionClass}
                >
                  {busy ? "Saving..." : faq.isPublished ? "Unpublish" : "Publish"}
                </button>
                <button
                  type="button"
                  aria-label={`Delete "${faq.question}"`}
                  onClick={(event) => onDelete(faq, event.currentTarget)}
                  disabled={busy}
                  className={`${actionClass} text-rose-700 hover:bg-rose-50`}
                >
                  Delete
                </button>
              </div>
            </div>

            {rowErrors[faq.faqId] ? (
              <p role="alert" className="text-xs font-semibold text-rose-700">
                {rowErrors[faq.faqId]}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
