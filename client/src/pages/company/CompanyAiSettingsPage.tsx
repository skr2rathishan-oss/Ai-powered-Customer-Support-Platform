import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { useCompanyPortal } from "../../components/company/useCompanyPortal";
import { useTicketAuthError } from "../../components/company/tickets/useTicketAuthError";
import { ROUTES } from "../../router/routes";
import {
  getAiSettings,
  getAiSettingsFieldErrors,
  saveAiSettings,
} from "../../services/aiSettings";
import {
  AI_LIMITS,
  AI_TONES,
  type AiSettings,
  type AiSettingsResult,
  type AiTone,
} from "../../types/aiSettings";

// Numbers are held as strings while editing so the inputs can be cleared
interface FormValues {
  enabled: boolean;
  assistantName: string;
  tone: AiTone;
  greeting: string;
  answerFromFaqsOnly: boolean;
  confidenceThreshold: string;
  escalateAfterFailures: string;
  fallbackMessage: string;
  customInstructions: string;
}

type FieldName = keyof FormValues;
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly string[] = [
  "enabled",
  "assistantName",
  "tone",
  "greeting",
  "answerFromFaqsOnly",
  "confidenceThreshold",
  "escalateAfterFailures",
  "fallbackMessage",
  "customInstructions",
];

const inputClass =
  "w-full bg-white border border-[#e2e4e9] rounded-xl py-2.5 px-3.5 text-sm text-[#1c1b23] focus:ring-2 focus:ring-[#6D5EF5]/30 focus:border-[#6D5EF5] outline-none disabled:opacity-60 aria-[invalid=true]:border-rose-400";
const labelClass = "block text-xs font-semibold text-[#474555] mb-1.5";
const hintClass = "mt-1 text-[11px] text-[#787586]";
const sectionClass = "bg-white border border-[#e2e4e9] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5 min-w-0";
const legendClass = "font-bold text-sm text-[#1c1b23] mb-4 float-left w-full";
const secondaryButton =
  "px-4 py-2.5 rounded-xl border border-[#e2e4e9] bg-white text-sm font-semibold text-[#474555] hover:bg-[#f6f2ff] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/30";

function toForm(settings: AiSettings): FormValues {
  return {
    ...settings,
    confidenceThreshold: String(settings.confidenceThreshold),
    escalateAfterFailures: String(settings.escalateAfterFailures),
  };
}

function parseWhole(raw: string): number | null {
  const text = raw.trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

function toPayload(values: FormValues): AiSettings {
  return {
    enabled: values.enabled,
    assistantName: values.assistantName.trim(),
    tone: values.tone,
    greeting: values.greeting.trim(),
    answerFromFaqsOnly: values.answerFromFaqsOnly,
    confidenceThreshold: parseWhole(values.confidenceThreshold) ?? Number.NaN,
    escalateAfterFailures: parseWhole(values.escalateAfterFailures) ?? Number.NaN,
    fallbackMessage: values.fallbackMessage.trim(),
    customInstructions: values.customInstructions.trim(),
  };
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.assistantName.trim();
  if (!name) errors.assistantName = "Assistant name is required";
  else if (name.length > AI_LIMITS.assistantNameMax) {
    errors.assistantName = `Assistant name must not exceed ${AI_LIMITS.assistantNameMax} characters`;
  }
  if (values.greeting.trim().length > AI_LIMITS.greetingMax) {
    errors.greeting = `Greeting must not exceed ${AI_LIMITS.greetingMax} characters`;
  }
  if (values.fallbackMessage.trim().length > AI_LIMITS.fallbackMax) {
    errors.fallbackMessage = `Fallback message must not exceed ${AI_LIMITS.fallbackMax} characters`;
  }
  if (values.customInstructions.trim().length > AI_LIMITS.instructionsMax) {
    errors.customInstructions = `Custom instructions must not exceed ${AI_LIMITS.instructionsMax} characters`;
  }
  const confidence = parseWhole(values.confidenceThreshold);
  if (
    confidence === null ||
    confidence < AI_LIMITS.confidenceMin ||
    confidence > AI_LIMITS.confidenceMax
  ) {
    errors.confidenceThreshold = `Confidence threshold must be a whole number between ${AI_LIMITS.confidenceMin} and ${AI_LIMITS.confidenceMax}`;
  }
  const escalate = parseWhole(values.escalateAfterFailures);
  if (
    escalate === null ||
    escalate < AI_LIMITS.escalateMin ||
    escalate > AI_LIMITS.escalateMax
  ) {
    errors.escalateAfterFailures = `Escalation count must be a whole number between ${AI_LIMITS.escalateMin} and ${AI_LIMITS.escalateMax}`;
  }
  return errors;
}

function formatUpdatedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

interface LoadOutcome {
  key: number;
  result?: AiSettingsResult;
  error?: string;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  counter?: string;
  children: ReactNode;
}

function Field({ id, label, error, hint, counter, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className={hintClass}>
          {hint}
        </p>
      ) : null}
      {counter ? <p className={`${hintClass} text-right`}>{counter}</p> : null}
    </div>
  );
}

export function CompanyAiSettingsPage() {
  const { refresh } = useCompanyPortal();
  const handleAuthError = useTicketAuthError();

  const [reloadToken, setReloadToken] = useState(0);
  const [outcome, setOutcome] = useState<LoadOutcome | null>(null);
  const [saved, setSaved] = useState<AiSettingsResult | null>(null);
  const [form, setForm] = useState<FormValues | null>(null);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;
    getAiSettings()
      .then((result) => {
        if (cancelled) return;
        setSaved(result);
        setForm(toForm(result.settings));
        setOutcome({ key: reloadToken, result });
      })
      .catch((error: unknown) => {
        if (cancelled || handleAuthError(error)) return;
        setOutcome({
          key: reloadToken,
          error: error instanceof Error ? error.message : "Could not load AI settings.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, handleAuthError]);

  const loading = outcome?.key !== reloadToken;
  const loadError = !loading ? outcome?.error : undefined;

  const clientErrors = form ? validate(form) : {};
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };
  const hasClientErrors = Object.keys(clientErrors).length > 0;
  const savedForm = saved ? toForm(saved.settings) : null;
  const dirty =
    form !== null && savedForm !== null && JSON.stringify(form) !== JSON.stringify(savedForm);

  function update<K extends FieldName>(name: K, value: FormValues[K]) {
    setForm((current) => (current ? { ...current, [name]: value } : current));
    setServerErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    setMessage("");
  }

  function a11y(name: FieldName, hint = false) {
    const ids = [errors[name] ? `ai-${name}-error` : "", hint ? `ai-${name}-hint` : ""]
      .filter(Boolean)
      .join(" ");
    return {
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": ids || undefined,
    } as const;
  }

  function focusFirstInvalid(names: string[]) {
    const first = FIELD_NAMES.find((name) => names.includes(name));
    if (first) formRef.current?.querySelector<HTMLElement>(`#ai-${first}`)?.focus();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || !form) return;

    setFormError(null);
    if (hasClientErrors) {
      focusFirstInvalid(Object.keys(clientErrors));
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const result = await saveAiSettings(toPayload(form));
      setSaved(result);
      setForm(toForm(result.settings));
      setServerErrors({});
      setMessage("AI settings saved");
      void refresh();
    } catch (error) {
      if (handleAuthError(error)) return;
      const mapped: FieldErrors = {};
      const unmapped: string[] = [];
      for (const item of getAiSettingsFieldErrors(error)) {
        if (FIELD_NAMES.includes(item.field)) {
          mapped[item.field as FieldName] ??= item.message;
        } else {
          unmapped.push(item.message);
        }
      }
      setServerErrors(mapped);
      if (unmapped.length > 0) {
        setFormError(unmapped.join(" "));
      } else if (Object.keys(mapped).length === 0) {
        setFormError(error instanceof Error ? error.message : "Could not save AI settings.");
      }
      focusFirstInvalid(Object.keys(mapped));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!saved) return;
    setForm(toForm(saved.defaults));
    setServerErrors({});
    setFormError(null);
    setMessage("");
  }

  function handleDiscard() {
    if (!saved) return;
    setForm(toForm(saved.settings));
    setServerErrors({});
    setFormError(null);
    setMessage("");
  }

  const updatedAt = formatUpdatedAt(saved?.updatedAt ?? null);
  const canSave = dirty && !hasClientErrors && !saving;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-[#6D5EF5]/10 text-[#6D5EF5] flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">
            smart_toy
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1c1b23] leading-tight">AI Settings</h1>
          <p className="text-sm text-[#787586]">
            Tune how the AI assistant responds and when it hands off to a human.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e2e4e9] bg-[#f6f2ff]/60 px-4 py-3 text-xs text-[#474555] flex items-start gap-2">
        <span className="material-symbols-outlined text-base text-[#6D5EF5]" aria-hidden="true">
          info
        </span>
        <p>
          Your assistant answers only from your published FAQs. Manage them on the{" "}
          <Link to={ROUTES.COMPANY_FAQS} className="text-[#6D5EF5] font-semibold">
            FAQs page
          </Link>
          .
        </p>
      </div>

      <div role="status" className={message ? "" : "sr-only"}>
        {message ? (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            {message}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div role="status" className="space-y-4" aria-busy="true" aria-label="Loading AI settings">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
          <span className="sr-only">Loading AI settings...</span>
        </div>
      ) : loadError || !form || !saved ? (
        <div className="bg-white border border-[#e2e4e9] rounded-2xl p-10 text-center space-y-3">
          <span className="material-symbols-outlined text-3xl text-rose-500" aria-hidden="true">
            error
          </span>
          <p role="alert" className="font-semibold text-rose-800 text-sm">
            {loadError ?? "Could not load AI settings."}
          </p>
          <button
            type="button"
            onClick={() => {
              setOutcome(null);
              setReloadToken((n) => n + 1);
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : (
        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-6">
          {saved.configured ? (
            <p className="text-xs text-[#787586]">
              Settings are active{updatedAt ? `. Last updated ${updatedAt}` : ""}.
            </p>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
              Not configured yet - showing defaults. Save to activate your settings.
            </div>
          )}

          {formError ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-3"
            >
              {formError}
            </div>
          ) : null}

          <fieldset disabled={saving} className={sectionClass}>
            <legend className={legendClass}>Assistant</legend>
            <label className="flex items-center gap-3 text-sm text-[#1c1b23] cursor-pointer">
              <input
                id="ai-enabled"
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => update("enabled", e.target.checked)}
                className="h-4 w-4 accent-[#6D5EF5]"
              />
              <span>
                Enable assistant
                <span className="ml-2 text-xs font-semibold text-[#787586]">
                  {form.enabled ? "Enabled" : "Disabled"}
                </span>
              </span>
            </label>
            <Field
              id="ai-assistantName"
              label="Assistant name"
              error={errors.assistantName}
              counter={`${form.assistantName.length}/${AI_LIMITS.assistantNameMax}`}
            >
              <input
                id="ai-assistantName"
                type="text"
                value={form.assistantName}
                onChange={(e) => update("assistantName", e.target.value)}
                className={inputClass}
                {...a11y("assistantName")}
              />
            </Field>
            <Field id="ai-tone" label="Tone" error={errors.tone}>
              <select
                id="ai-tone"
                value={form.tone}
                onChange={(e) => update("tone", e.target.value as AiTone)}
                className={inputClass}
                {...a11y("tone")}
              >
                {AI_TONES.map((tone) => (
                  <option key={tone.value} value={tone.value}>
                    {tone.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id="ai-greeting"
              label="Greeting"
              error={errors.greeting}
              counter={`${form.greeting.length}/${AI_LIMITS.greetingMax}`}
            >
              <textarea
                id="ai-greeting"
                rows={3}
                value={form.greeting}
                onChange={(e) => update("greeting", e.target.value)}
                className={inputClass}
                {...a11y("greeting")}
              />
            </Field>
          </fieldset>

          <fieldset disabled={saving} className={sectionClass}>
            <legend className={legendClass}>Answering</legend>
            <label className="flex items-center gap-3 text-sm text-[#1c1b23] cursor-pointer">
              <input
                id="ai-answerFromFaqsOnly"
                type="checkbox"
                checked={form.answerFromFaqsOnly}
                onChange={(e) => update("answerFromFaqsOnly", e.target.checked)}
                className="h-4 w-4 accent-[#6D5EF5]"
              />
              Only answer from published FAQs
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field
                id="ai-confidenceThreshold"
                label="Confidence threshold (%)"
                error={errors.confidenceThreshold}
                hint="Answers below this confidence count as a failed answer."
              >
                <input
                  id="ai-confidenceThreshold"
                  type="number"
                  inputMode="numeric"
                  min={AI_LIMITS.confidenceMin}
                  max={AI_LIMITS.confidenceMax}
                  step={1}
                  value={form.confidenceThreshold}
                  onChange={(e) => update("confidenceThreshold", e.target.value)}
                  className={inputClass}
                  {...a11y("confidenceThreshold", true)}
                />
              </Field>
              <Field
                id="ai-escalateAfterFailures"
                label="Escalate to a human after N failed answers"
                error={errors.escalateAfterFailures}
                hint="Consecutive failed answers in one conversation."
              >
                <input
                  id="ai-escalateAfterFailures"
                  type="number"
                  inputMode="numeric"
                  min={AI_LIMITS.escalateMin}
                  max={AI_LIMITS.escalateMax}
                  step={1}
                  value={form.escalateAfterFailures}
                  onChange={(e) => update("escalateAfterFailures", e.target.value)}
                  className={inputClass}
                  {...a11y("escalateAfterFailures", true)}
                />
              </Field>
            </div>
            <Field
              id="ai-fallbackMessage"
              label="Fallback message"
              error={errors.fallbackMessage}
              counter={`${form.fallbackMessage.length}/${AI_LIMITS.fallbackMax}`}
            >
              <textarea
                id="ai-fallbackMessage"
                rows={3}
                value={form.fallbackMessage}
                onChange={(e) => update("fallbackMessage", e.target.value)}
                className={inputClass}
                {...a11y("fallbackMessage")}
              />
            </Field>
          </fieldset>

          <fieldset disabled={saving} className={sectionClass}>
            <legend className={legendClass}>Custom instructions</legend>
            <Field
              id="ai-customInstructions"
              label="Custom instructions"
              error={errors.customInstructions}
              counter={`${form.customInstructions.length}/${AI_LIMITS.instructionsMax}`}
            >
              <textarea
                id="ai-customInstructions"
                rows={5}
                value={form.customInstructions}
                onChange={(e) => update("customInstructions", e.target.value)}
                className={inputClass}
                {...a11y("customInstructions")}
              />
            </Field>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canSave}
              className="px-5 py-2.5 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-[#6D5EF5]/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6D5EF5]/40"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button type="button" onClick={handleReset} disabled={saving} className={secondaryButton}>
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving || !dirty}
              className={secondaryButton}
            >
              Discard changes
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
