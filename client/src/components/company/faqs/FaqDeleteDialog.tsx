import { useEffect, useRef } from "react";
import type { Faq } from "../../../types/faqs";

interface FaqDeleteDialogProps {
  faq: Faq;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function FaqDeleteDialog({
  faq,
  saving,
  error,
  onCancel,
  onConfirm,
}: FaqDeleteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [saving, onCancel]);

  const preview =
    faq.question.length > 80 ? `${faq.question.slice(0, 80)}...` : faq.question;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faq-delete-title"
        aria-describedby="faq-delete-description"
        className="bg-white border border-[#e2e4e9] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden"
      >
        <div className="p-6 space-y-3">
          <h2 id="faq-delete-title" className="text-base font-bold text-[#1c1b23]">
            Delete this FAQ?
          </h2>
          <p id="faq-delete-description" className="text-sm text-[#474555] break-words">
            &lsquo;{preview}&rsquo; will be removed permanently. This cannot be
            undone.
          </p>
          {error ? (
            <p role="alert" className="text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
        </div>
        <div className="p-5 border-t border-[#e2e4e9] bg-[#fbfbfe] flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-[#e2e4e9] bg-white text-sm font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            {saving ? <span className="spinner" aria-hidden="true" /> : null}
            {saving ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
