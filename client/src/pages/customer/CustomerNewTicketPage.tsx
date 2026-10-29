import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useCustomerAuthError } from "../../components/customer/useCustomerAuthError";
import { useCustomerPortal } from "../../components/customer/useCustomerPortal";
import { customerTicketPath, ROUTES } from "../../router/routes";
import {
  createCustomerTicket,
  getErrorCode,
  getFieldErrors,
  listCustomerFaqs,
} from "../../services/customer";
import type { PublicFaq } from "../../types/customer";

const SUBJECT_MIN = 3;
const SUBJECT_MAX = 200;
const DESCRIPTION_MAX = 5000;
const SUGGESTION_LIMIT = 5;

type Field = "subject" | "description";
type Errors = Partial<Record<Field, string>>;

function validate(field: Field, value: string): string | undefined {
  const trimmed = value.trim();
  if (field === "subject") {
    if (!trimmed) return "Subject is required.";
    if (trimmed.length < SUBJECT_MIN || trimmed.length > SUBJECT_MAX) {
      return `Subject must be between ${SUBJECT_MIN} and ${SUBJECT_MAX} characters.`;
    }
    return undefined;
  }
  if (!trimmed) return "Description is required.";
  if (trimmed.length > DESCRIPTION_MAX) {
    return `Description must not exceed ${DESCRIPTION_MAX} characters.`;
  }
  return undefined;
}

const inputClass = (invalid: boolean) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1c1b23] focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30 ${
    invalid ? "border-rose-400" : "border-[#e2e4e9]"
  }`;

export function CustomerNewTicketPage() {
  const navigate = useNavigate();
  const handleAuthError = useCustomerAuthError();
  const { data } = useCustomerPortal();
  const { assistant } = data;

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [faqs, setFaqs] = useState<PublicFaq[]>([]);

  useEffect(() => {
    let cancelled = false;
    listCustomerFaqs()
      .then((result) => {
        if (!cancelled) setFaqs(result.faqs);
      })
      .catch(() => {
        // Suggestions are optional; the form works without them.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => {
    const term = subject.trim().toLowerCase();
    const matches = term
      ? faqs.filter(
          (faq) =>
            faq.question.toLowerCase().includes(term) ||
            faq.answer.toLowerCase().includes(term),
        )
      : faqs;
    return matches.slice(0, SUGGESTION_LIMIT);
  }, [faqs, subject]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: Errors = {
      subject: validate("subject", subject),
      description: validate("description", description),
    };
    setErrors(nextErrors);
    setSubmitError("");
    if (nextErrors.subject || nextErrors.description) return;

    setSubmitting(true);
    try {
      const ticket = await createCustomerTicket({
        subject: subject.trim(),
        description: description.trim(),
      });
      navigate(customerTicketPath(ticket.ticketId), {
        state: { toast: `Ticket #${ticket.ticketId} submitted` },
      });
    } catch (error) {
      if (handleAuthError(error)) return;
      const fieldErrors = getFieldErrors(error);
      if (fieldErrors.length > 0) {
        const mapped: Errors = {};
        for (const item of fieldErrors) {
          if (item.field === "subject" || item.field === "description") {
            mapped[item.field] = item.message;
          }
        }
        setErrors(mapped);
      }
      setSubmitError(
        getErrorCode(error) === "TICKET_LIMIT_REACHED" || fieldErrors.length === 0
          ? error instanceof Error
            ? error.message
            : "Could not submit your ticket."
          : "Please fix the highlighted fields.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-[#6D5EF5]/10 text-[#6D5EF5] flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">
            add_circle
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1c1b23] leading-tight">New ticket</h1>
          <p className="text-sm text-[#787586]">
            Tell {data.company.companyName} what you need help with.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="lg:col-span-2 bg-white border border-[#e2e4e9] rounded-2xl p-6 shadow-2xs space-y-5"
        >
          {submitError ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm font-semibold px-4 py-3"
            >
              {submitError}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="ticket-subject" className="text-xs font-semibold text-[#474555]">
              Subject
            </label>
            <input
              id="ticket-subject"
              type="text"
              value={subject}
              disabled={submitting}
              aria-invalid={Boolean(errors.subject)}
              aria-describedby={errors.subject ? "ticket-subject-error" : undefined}
              onChange={(event) => {
                setSubject(event.target.value);
                setErrors((current) => ({ ...current, subject: undefined }));
              }}
              onBlur={() => setErrors((current) => ({ ...current, subject: validate("subject", subject) }))}
              className={inputClass(Boolean(errors.subject))}
            />
            <div className="flex justify-between gap-3">
              <p id="ticket-subject-error" role="alert" className="text-xs text-rose-600 min-h-4">
                {errors.subject}
              </p>
              <p className="text-xs text-[#787586] shrink-0">
                {subject.length}/{SUBJECT_MAX}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ticket-description" className="text-xs font-semibold text-[#474555]">
              Description
            </label>
            <textarea
              id="ticket-description"
              rows={8}
              value={description}
              disabled={submitting}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? "ticket-description-error" : undefined}
              onChange={(event) => {
                setDescription(event.target.value);
                setErrors((current) => ({ ...current, description: undefined }));
              }}
              onBlur={() =>
                setErrors((current) => ({
                  ...current,
                  description: validate("description", description),
                }))
              }
              className={inputClass(Boolean(errors.description))}
            />
            <div className="flex justify-between gap-3">
              <p id="ticket-description-error" role="alert" className="text-xs text-rose-600 min-h-4">
                {errors.description}
              </p>
              <p className="text-xs text-[#787586] shrink-0">
                {description.length}/{DESCRIPTION_MAX}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white text-sm font-bold shadow-md shadow-[#6D5EF5]/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? "Submitting..." : "Submit ticket"}
            </button>
            <Link
              to={ROUTES.CUSTOMER_TICKETS}
              className="px-4 py-2.5 rounded-xl border border-[#e2e4e9] text-sm font-semibold text-[#474555] hover:bg-[#f6f2ff] no-underline"
            >
              Cancel
            </Link>
          </div>
        </form>

        <aside
          aria-label="Suggested help"
          className="bg-white border border-[#e2e4e9] rounded-2xl p-5 shadow-2xs space-y-4"
        >
          {assistant.enabled ? (
            <p
              data-testid="assistant-greeting"
              className="rounded-xl bg-[#f6f2ff] text-[#474555] text-sm px-4 py-3"
            >
              <span className="font-bold text-[#6D5EF5]">{assistant.assistantName}:</span>{" "}
              {assistant.greeting}
            </p>
          ) : null}

          <h2 className="text-sm font-bold text-[#1c1b23]">Maybe this helps</h2>
          {suggestions.length === 0 ? (
            <p className="text-xs text-[#787586]">
              No matching help articles. Go ahead and submit your ticket.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="faq-suggestions">
              {suggestions.map((faq) => (
                <li key={faq.faqId}>
                  <details className="rounded-lg border border-[#e2e4e9] px-3 py-2">
                    <summary className="text-sm font-semibold text-[#1c1b23] cursor-pointer">
                      {faq.question}
                    </summary>
                    <p className="mt-2 text-xs text-[#474555] whitespace-pre-wrap break-words">
                      {faq.answer}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
