import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFaq, getFaqFieldErrors, updateFaq } from "../../../services/faqs";
import type { Faq } from "../../../types/faqs";
import { useTicketAuthError } from "../tickets/useTicketAuthError";

interface FaqFormModalProps {
  faq: Faq | null;
  categories: string[];
  onClose: () => void;
  onSaved: (faq: Faq, mode: "created" | "updated") => void;
}

type FieldName = "question" | "answer" | "category" | "sortOrder";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly string[] = ["question", "answer", "category", "sortOrder"];
const QUESTION_MIN = 5;
const QUESTION_MAX = 300;
const ANSWER_MAX = 4000;
const CATEGORY_MAX = 60;
const SORT_MAX = 9999;

const inputClass =
  "w-full bg-white border border-[#e2e4e9] rounded-xl py-2.5 px-3.5 text-sm text-[#1c1b23] focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] outline-none disabled:opacity-60 aria-[invalid=true]:border-rose-400";
const labelClass = "block text-xs font-semibold text-[#474555] mb-1.5";
const counterClass = "mt-1 text-[11px] text-[#787586] text-right";

interface Values {
  question: string;
  answer: string;
  category: string;
  sortOrder: string;
}

function validate(values: Values): FieldErrors {
  const errors: FieldErrors = {};
  const question = values.question.trim();
  if (!question) errors.question = "Question is required";
  else if (question.length < QUESTION_MIN) {
    errors.question = `Question must be at least ${QUESTION_MIN} characters`;
  } else if (question.length > QUESTION_MAX) {
    errors.question = `Question must not exceed ${QUESTION_MAX} characters`;
  }

  const answer = values.answer.trim();
  if (!answer) errors.answer = "Answer is required";
  else if (answer.length > ANSWER_MAX) {
    errors.answer = `Answer must not exceed ${ANSWER_MAX} characters`;
  }

  if (values.category.trim().length > CATEGORY_MAX) {
    errors.category = `Category must not exceed ${CATEGORY_MAX} characters`;
  }

  const order = values.sortOrder.trim();
  if (order) {
    const parsed = Number(order);
    if (!/^\d+$/.test(order) || parsed > SORT_MAX) {
      errors.sortOrder = `Display order must be a whole number from 0 to ${SORT_MAX}`;
    }
  }
  return errors;
}

export function FaqFormModal({ faq, categories, onClose, onSaved }: FaqFormModalProps) {
  const editing = faq !== null;
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [category, setCategory] = useState(faq?.category ?? "");
  const [sortOrder, setSortOrder] = useState(faq ? String(faq.sortOrder) : "");
  const [isPublished, setIsPublished] = useState(faq?.isPublished ?? false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  const handleAuthError = useTicketAuthError();

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [saving, onClose]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const clientErrors = validate({ question, answer, category, sortOrder });
    setFormError(null);
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    const input = {
      question: question.trim(),
      answer: answer.trim(),
      category: category.trim() || null,
      isPublished,
      ...(sortOrder.trim() ? { sortOrder: Number(sortOrder.trim()) } : {}),
    };

    setSaving(true);
    try {
      const saved = faq ? await updateFaq(faq.faqId, input) : await createFaq(input);
      onSaved(saved, faq ? "updated" : "created");
    } catch (error) {
      if (handleAuthError(error)) return;
      const mapped: FieldErrors = {};
      const unmapped: string[] = [];
      for (const item of getFaqFieldErrors(error)) {
        if (FIELD_NAMES.includes(item.field)) {
          mapped[item.field as FieldName] ??= item.message;
        } else {
          unmapped.push(item.message);
        }
      }
      setFieldErrors(mapped);
      if (unmapped.length > 0) {
        setFormError(unmapped.join(" "));
      } else if (Object.keys(mapped).length === 0) {
        setFormError(error instanceof Error ? error.message : "Could not save the FAQ.");
      }
      setSaving(false);
    }
  }

  function errorProps(name: FieldName) {
    const message = fieldErrors[name];
    return {
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? `faq-${name}-error` : undefined,
    } as const;
  }

  function renderError(name: FieldName) {
    const message = fieldErrors[name];
    if (!message) return null;
    return (
      <p id={`faq-${name}-error`} role="alert" className="mt-1 text-[11px] font-medium text-rose-600">
        {message}
      </p>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faq-form-title"
        className="bg-white border border-[#e2e4e9] rounded-3xl max-w-lg w-full shadow-2xl my-auto overflow-hidden"
      >
        <div className="p-5 border-b border-[#e2e4e9] flex items-center justify-between bg-[#fbfbfe]">
          <h2 id="faq-form-title" className="text-base font-bold text-[#1c1b23]">
            {editing ? "Edit FAQ" : "Add FAQ"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-[#787586] flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset disabled={saving} className="p-5 space-y-4">
            {formError ? (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800"
              >
                {formError}
              </div>
            ) : null}

            <div>
              <label htmlFor="faq-question" className={labelClass}>
                Question
              </label>
              <input
                id="faq-question"
                ref={firstRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className={inputClass}
                {...errorProps("question")}
              />
              <p className={counterClass}>
                {question.length}/{QUESTION_MAX}
              </p>
              {renderError("question")}
            </div>

            <div>
              <label htmlFor="faq-answer" className={labelClass}>
                Answer
              </label>
              <textarea
                id="faq-answer"
                rows={6}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className={`${inputClass} resize-y`}
                {...errorProps("answer")}
              />
              <p className={counterClass}>
                {answer.length}/{ANSWER_MAX}
              </p>
              {renderError("answer")}
            </div>

            <div className={editing ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : undefined}>
              <div>
                <label htmlFor="faq-category" className={labelClass}>
                  Category (optional)
                </label>
                <input
                  id="faq-category"
                  type="text"
                  list="faq-category-options"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                  {...errorProps("category")}
                />
                <datalist id="faq-category-options">
                  {categories.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {renderError("category")}
              </div>
              {editing ? (
                <div>
                  <label htmlFor="faq-sort-order" className={labelClass}>
                    Display order
                  </label>
                  <input
                    id="faq-sort-order"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={SORT_MAX}
                    step={1}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className={inputClass}
                    {...errorProps("sortOrder")}
                  />
                  {renderError("sortOrder")}
                </div>
              ) : null}
            </div>

            <label className="flex items-center gap-2 text-sm text-[#474555] cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 accent-[#6D5EF5]"
              />
              {editing ? "Published" : "Publish immediately"}
            </label>
          </fieldset>

          <div className="p-5 border-t border-[#e2e4e9] bg-[#fbfbfe] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-[#e2e4e9] bg-white text-sm font-semibold text-[#474555] hover:bg-[#f6f2ff] cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? <span className="spinner" aria-hidden="true" /> : null}
              {saving ? "Saving..." : editing ? "Save changes" : "Save FAQ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
