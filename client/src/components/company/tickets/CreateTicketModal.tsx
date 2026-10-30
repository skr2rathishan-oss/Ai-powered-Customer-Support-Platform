import { useEffect, useRef, useState, type FormEvent } from "react";
import { createTicket, getFieldErrors } from "../../../services/tickets";
import {
  TICKET_PRIORITIES,
  type AssignableAgent,
  type CreateTicketInput,
  type Ticket,
  type TicketPriority,
} from "../../../types/tickets";
import { agentLabel } from "./ticketFormat";
import { useTicketAuthError } from "./useTicketAuthError";

interface CreateTicketModalProps {
  agents: AssignableAgent[];
  onClose: () => void;
  onCreated: (ticket: Ticket) => void;
}

type FieldName =
  | "subject"
  | "description"
  | "priority"
  | "requesterName"
  | "requesterEmail"
  | "assignedAgentId";

type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly string[] = [
  "subject",
  "description",
  "priority",
  "requesterName",
  "requesterEmail",
  "assignedAgentId",
];

const DESCRIPTION_MAX = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  "w-full bg-white border border-[#e2e4e9] rounded-xl py-2.5 px-3.5 text-sm text-[#1c1b23] focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] outline-none disabled:opacity-60 aria-[invalid=true]:border-rose-400";
const labelClass = "block text-xs font-semibold text-[#474555] mb-1.5";

function validate(values: {
  subject: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const subject = values.subject.trim();
  if (subject.length < 3 || subject.length > 200) {
    errors.subject = "Subject must be between 3 and 200 characters";
  }
  const description = values.description.trim();
  if (!description) {
    errors.description = "Description is required";
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Description must be at most ${DESCRIPTION_MAX} characters`;
  }
  if (values.requesterName.trim().length > 150) {
    errors.requesterName = "Requester name must be at most 150 characters";
  }
  const email = values.requesterEmail.trim();
  if (email && (!EMAIL_PATTERN.test(email) || email.length > 255)) {
    errors.requesterEmail = "Enter a valid email address";
  }
  return errors;
}

export function CreateTicketModal({
  agents,
  onClose,
  onCreated,
}: CreateTicketModalProps) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("Medium");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [assignee, setAssignee] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const handleAuthError = useTicketAuthError();

  useEffect(() => {
    subjectRef.current?.focus();
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

    const clientErrors = validate({
      subject,
      description,
      requesterName,
      requesterEmail,
    });
    setFormError(null);
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    const input: CreateTicketInput = {
      subject: subject.trim(),
      description: description.trim(),
      priority,
    };
    if (requesterName.trim()) input.requesterName = requesterName.trim();
    if (requesterEmail.trim()) input.requesterEmail = requesterEmail.trim();
    if (assignee) input.assignedAgentId = Number(assignee);

    setSaving(true);
    try {
      const ticket = await createTicket(input);
      onCreated(ticket);
    } catch (error) {
      if (handleAuthError(error)) return;
      const serverErrors = getFieldErrors(error);
      const mapped: FieldErrors = {};
      const unmapped: string[] = [];
      for (const item of serverErrors) {
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
          error instanceof Error ? error.message : "Could not create the ticket.",
        );
      }
      setSaving(false);
    }
  }

  function errorProps(name: FieldName) {
    const message = fieldErrors[name];
    return {
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? `ticket-${name}-error` : undefined,
    } as const;
  }

  function renderError(name: FieldName) {
    const message = fieldErrors[name];
    if (!message) return null;
    return (
      <p
        id={`ticket-${name}-error`}
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
        aria-labelledby="create-ticket-title"
        className="bg-white border border-[#e2e4e9] rounded-3xl max-w-xl w-full shadow-2xl my-auto max-h-[92vh] flex flex-col overflow-hidden"
      >
        <div className="p-5 border-b border-[#e2e4e9] flex items-center justify-between bg-[#fbfbfe]">
          <h2 id="create-ticket-title" className="text-base font-bold text-[#1c1b23]">
            New ticket
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

        <form onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0">
          <fieldset disabled={saving} className="p-5 space-y-4 overflow-y-auto">
            {formError ? (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800"
              >
                {formError}
              </div>
            ) : null}

            <div>
              <label htmlFor="ticket-subject" className={labelClass}>
                Subject
              </label>
              <input
                id="ticket-subject"
                ref={subjectRef}
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputClass}
                {...errorProps("subject")}
              />
              {renderError("subject")}
            </div>

            <div>
              <label htmlFor="ticket-description" className={labelClass}>
                Description
              </label>
              <textarea
                id="ticket-description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
                {...errorProps("description")}
              />
              <div className="flex justify-between items-start">
                <div>{renderError("description")}</div>
                <p
                  className={`mt-1 text-[11px] ${
                    description.length > DESCRIPTION_MAX
                      ? "text-rose-600"
                      : "text-[#787586]"
                  }`}
                >
                  {description.length}/{DESCRIPTION_MAX}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ticket-priority" className={labelClass}>
                  Priority
                </label>
                <select
                  id="ticket-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className={inputClass}
                  {...errorProps("priority")}
                >
                  {TICKET_PRIORITIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                {renderError("priority")}
              </div>
              <div>
                <label htmlFor="ticket-assignee" className={labelClass}>
                  Assign to
                </label>
                <select
                  id="ticket-assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className={inputClass}
                  {...errorProps("assignedAgentId")}
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.userId} value={String(agent.userId)}>
                      {agentLabel(agent)}
                    </option>
                  ))}
                </select>
                {renderError("assignedAgentId")}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ticket-requester-name" className={labelClass}>
                  Requester name (optional)
                </label>
                <input
                  id="ticket-requester-name"
                  type="text"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className={inputClass}
                  {...errorProps("requesterName")}
                />
                {renderError("requesterName")}
              </div>
              <div>
                <label htmlFor="ticket-requester-email" className={labelClass}>
                  Requester email (optional)
                </label>
                <input
                  id="ticket-requester-email"
                  type="email"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                  className={inputClass}
                  {...errorProps("requesterEmail")}
                />
                {renderError("requesterEmail")}
              </div>
            </div>
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
              {saving ? "Creating..." : "Create ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
