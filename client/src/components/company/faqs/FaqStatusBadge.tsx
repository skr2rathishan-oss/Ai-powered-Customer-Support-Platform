export function FaqStatusBadge({ isPublished }: { isPublished: boolean }) {
  const classes = isPublished
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span
      data-testid="faq-status-badge"
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap ${classes}`}
    >
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}
