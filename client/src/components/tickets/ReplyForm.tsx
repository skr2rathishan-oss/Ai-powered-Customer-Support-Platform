import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { getErrorCode, getFieldErrors } from "../../services/tickets";

const REPLY_MAX = 5000;

interface ReplyFormProps {
  allowInternal: boolean;
  // Resolves when the reply was saved; rejects with the API error otherwise
  onSubmit: (body: string, isInternal: boolean) => Promise<void>;
  // When set the form is replaced by this explanation
  disabledReason?: string | null;
  hint?: string | null;
  idPrefix?: string;
}

export function ReplyForm({
  allowInternal,
  onSubmit,
  disabledReason,
  hint,
  idPrefix = "reply",
}: ReplyFormProps) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (disabledReason) {
    return (
      <p className="rounded-xl bg-slate-50 border border-[#e2e4e9] text-sm text-[#474555] px-4 py-3">
        {disabledReason}
      </p>
    );
  }

  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && !saving;

  async function submit() {
    if (!canSend) return;
    setSaving(true);
    setError(null);
    setSent(null);
    try {
      await onSubmit(trimmed, allowInternal && internal);
      setBody("");
      setSent(internal && allowInternal ? "Internal note added." : "Reply sent.");
      textareaRef.current?.focus();
    } catch (caught) {
      const fieldMessage = getFieldErrors(caught)[0]?.message;
      const code = getErrorCode(caught);
      setError(
        fieldMessage ??
          (code === "TICKET_CLOSED"
            ? "This ticket is closed and cannot receive replies."
            : caught instanceof Error
              ? caught.message
              : "Could not send your reply. Please try again."),
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {allowInternal ? (
        <fieldset className="flex flex-wrap gap-4 text-sm text-[#1c1b23]">
          <legend className="sr-only">Reply type</legend>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${idPrefix}-type`}
              checked={!internal}
              onChange={() => setInternal(false)}
            />
            Reply to customer
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${idPrefix}-type`}
              checked={internal}
              onChange={() => setInternal(true)}
            />
            Internal note
          </label>
        </fieldset>
      ) : null}

      <div>
        <label
          htmlFor={`${idPrefix}-body`}
          className="block text-xs font-semibold text-[#474555] mb-1"
        >
          Reply
        </label>
        <textarea
          id={`${idPrefix}-body`}
          ref={textareaRef}
          value={body}
          maxLength={REPLY_MAX}
          rows={4}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm text-[#1c1b23] focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30 ${
            internal && allowInternal
              ? "border-amber-300 bg-amber-50"
              : "border-[#e2e4e9] bg-white"
          }`}
          placeholder={
            internal && allowInternal
              ? "Write a note for your team"
              : "Write your reply"
          }
        />
        <p className="text-[11px] text-[#787586] mt-1 text-right">
          {body.length} / {REPLY_MAX}
        </p>
      </div>

      {hint ? <p className="text-xs text-[#787586]">{hint}</p> : null}

      {error ? (
        <p role="alert" className="text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
      {sent ? (
        <p role="status" className="text-sm font-semibold text-emerald-700">
          {sent}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSend}
          className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-[#6D5EF5]/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/40"
        >
          {saving ? "Sending..." : "Send reply"}
        </button>
      </div>
    </form>
  );
}
