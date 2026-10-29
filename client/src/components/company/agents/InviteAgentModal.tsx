import { useEffect, useRef, useState, type FormEvent } from "react";
import { getAgentFieldErrors, inviteAgent } from "../../../services/agents";
import type { InviteAgentResult } from "../../../types/agents";
import { useTicketAuthError } from "../tickets/useTicketAuthError";

interface InviteAgentModalProps {
  onClose: () => void;
  onInvited: (result: InviteAgentResult) => void;
}

type FieldName = "firstName" | "lastName" | "email";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly string[] = ["firstName", "lastName", "email"];
const NAME_MAX = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  "w-full bg-white border border-[#e2e4e9] rounded-xl py-2.5 px-3.5 text-sm text-[#1c1b23] focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] outline-none disabled:opacity-60 aria-[invalid=true]:border-rose-400";
const labelClass = "block text-xs font-semibold text-[#474555] mb-1.5";

function validate(values: Record<FieldName, string>): FieldErrors {
  const errors: FieldErrors = {};
  const first = values.firstName.trim();
  if (!first) errors.firstName = "First name is required";
  else if (first.length > NAME_MAX) {
    errors.firstName = `First name must not exceed ${NAME_MAX} characters`;
  }
  const last = values.lastName.trim();
  if (!last) errors.lastName = "Last name is required";
  else if (last.length > NAME_MAX) {
    errors.lastName = `Last name must not exceed ${NAME_MAX} characters`;
  }
  const email = values.email.trim();
  if (!email) errors.email = "Email is required";
  else if (!EMAIL_PATTERN.test(email) || email.length > 255) {
    errors.email = "Enter a valid email address";
  }
  return errors;
}

export function InviteAgentModal({ onClose, onInvited }: InviteAgentModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
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

    const clientErrors = validate({ firstName, lastName, email });
    setFormError(null);
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    try {
      const result = await inviteAgent({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      onInvited(result);
    } catch (error) {
      if (handleAuthError(error)) return;
      const mapped: FieldErrors = {};
      const unmapped: string[] = [];
      for (const item of getAgentFieldErrors(error)) {
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
        setFormError(
          error instanceof Error ? error.message : "Could not send the invite.",
        );
      }
      setSaving(false);
    }
  }

  function errorProps(name: FieldName) {
    const message = fieldErrors[name];
    return {
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? `invite-${name}-error` : undefined,
    } as const;
  }

  function renderError(name: FieldName) {
    const message = fieldErrors[name];
    if (!message) return null;
    return (
      <p
        id={`invite-${name}-error`}
        role="alert"
        className="mt-1 text-[11px] font-medium text-rose-600"
      >
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
        aria-labelledby="invite-agent-title"
        className="bg-white border border-[#e2e4e9] rounded-3xl max-w-md w-full shadow-2xl my-auto overflow-hidden"
      >
        <div className="p-5 border-b border-[#e2e4e9] flex items-center justify-between bg-[#fbfbfe]">
          <h2 id="invite-agent-title" className="text-base font-bold text-[#1c1b23]">
            Invite agent
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="invite-first-name" className={labelClass}>
                  First name
                </label>
                <input
                  id="invite-first-name"
                  ref={firstRef}
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                  {...errorProps("firstName")}
                />
                {renderError("firstName")}
              </div>
              <div>
                <label htmlFor="invite-last-name" className={labelClass}>
                  Last name
                </label>
                <input
                  id="invite-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                  {...errorProps("lastName")}
                />
                {renderError("lastName")}
              </div>
            </div>

            <div>
              <label htmlFor="invite-email" className={labelClass}>
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                {...errorProps("email")}
              />
              {renderError("email")}
            </div>
            <p className="text-[11px] text-[#787586]">
              We email a link so the agent can choose a password. It expires in
              72 hours.
            </p>
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
              {saving ? "Sending..." : "Send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
