import { useEffect, useState, type ReactNode } from "react";
import {
  onboardCompany,
  OnboardCompanyError,
  type CompanyDetailData,
  type OnboardCompanyPayload,
} from "../../../services/admin";
import type {
  CompanyRegistrationErrors,
  CompanyRegistrationField,
  CompanyRegistrationValues,
} from "../../../types/auth";
import {
  INDUSTRIES,
  validateRegistrationField,
  validateRegistrationForm,
} from "../../../validation/companyRegistration";

interface OnboardCompanyModalProps {
  open: boolean;
  onClose: () => void;
  onOnboarded: (company: CompanyDetailData) => void;
}

const initialValues: CompanyRegistrationValues = {
  companyName: "",
  industry: "",
  businessEmail: "",
  phone: "",
  website: "",
  description: "",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  password: "",
  confirmPassword: "",
};

const inputClass =
  "w-full bg-[#f6f2ff]/60 border rounded-xl py-2 px-3 text-xs text-[#1c1b23] outline-none transition-all placeholder-[#787586] focus:ring-2 focus:ring-[#6D5EF5]/20 focus:border-[#6D5EF5]";

function FormField({
  id,
  label,
  required,
  error,
  className = "",
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[11px] font-bold text-[#474555] mb-1">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[11px] font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function OnboardCompanyModal({ open, onClose, onOnboarded }: OnboardCompanyModalProps) {
  const [values, setValues] = useState<CompanyRegistrationValues>(initialValues);
  const [status, setStatus] = useState<OnboardCompanyPayload["status"]>("Active");
  const [errors, setErrors] = useState<CompanyRegistrationErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // Start from a blank form every time the modal opens
  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setStatus("Active");
      setErrors({});
      setSubmitError("");
      setPasswordVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  function updateField(field: CompanyRegistrationField, value: string) {
    setValues((curr) => ({ ...curr, [field]: value }));
    setErrors((curr) => ({ ...curr, [field]: undefined }));
    setSubmitError("");
  }

  function handleBlur(field: CompanyRegistrationField) {
    setErrors((curr) => ({ ...curr, [field]: validateRegistrationField(field, values) }));
  }

  function fieldProps(field: CompanyRegistrationField, id: string) {
    return {
      id,
      name: field,
      value: values[field],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        updateField(field, event.target.value),
      onBlur: () => handleBlur(field),
      "aria-invalid": Boolean(errors[field]),
      "aria-describedby": errors[field] ? `${id}-error` : undefined,
      className: `${inputClass} ${errors[field] ? "border-rose-400" : "border-[#e2e4e9]"}`,
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validateRegistrationForm(values);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      setSubmitError("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    setSubmitError("");
    try {
      const { confirmPassword: _confirm, ...registration } = values;
      const company = await onboardCompany({ ...registration, status });
      onOnboarded(company);
    } catch (err) {
      if (err instanceof OnboardCompanyError) {
        setSubmitError(err.message);
        setErrors(err.fieldErrors as CompanyRegistrationErrors);
      } else {
        setSubmitError("Failed to onboard company. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-fadeIn">
      <form
        onSubmit={handleSubmit}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-company-title"
        className="bg-white border border-[#e2e4e9] rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-[#e2e4e9] flex items-center justify-between bg-[#fbfbfe]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#6D5EF5] text-white flex items-center justify-center shadow-md shadow-[#6D5EF5]/20">
              <span className="material-symbols-outlined text-xl">add_business</span>
            </div>
            <div>
              <h2 id="onboard-company-title" className="text-base font-bold text-[#1c1b23] leading-tight">
                Onboard Enterprise
              </h2>
              <p className="text-xs text-[#787586] mt-0.5">
                Register a company and create its administrator account.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-[#787586] hover:text-[#1c1b23] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {submitError && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {submitError}
            </div>
          )}

          <fieldset className="space-y-4">
            <legend className="font-bold text-xs text-[#1c1b23] uppercase tracking-wider mb-3">
              Company Information
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="onboard-company-name" label="Company name" required error={errors.companyName} className="sm:col-span-2">
                <input type="text" placeholder="Acme Corporation" autoFocus {...fieldProps("companyName", "onboard-company-name")} />
              </FormField>
              <FormField id="onboard-industry" label="Industry" required error={errors.industry}>
                <select {...fieldProps("industry", "onboard-industry")}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="onboard-status" label="Initial status" required>
                <select
                  id="onboard-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as OnboardCompanyPayload["status"])}
                  className={`${inputClass} border-[#e2e4e9]`}
                >
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                </select>
              </FormField>
              <FormField id="onboard-business-email" label="Business email" required error={errors.businessEmail}>
                <input type="email" placeholder="contact@acme.com" autoComplete="off" {...fieldProps("businessEmail", "onboard-business-email")} />
              </FormField>
              <FormField id="onboard-phone" label="Phone" error={errors.phone}>
                <input type="tel" placeholder="+94 77 123 4567" {...fieldProps("phone", "onboard-phone")} />
              </FormField>
              <FormField id="onboard-website" label="Website" error={errors.website} className="sm:col-span-2">
                <input type="url" placeholder="https://acme.com" {...fieldProps("website", "onboard-website")} />
              </FormField>
              <FormField id="onboard-description" label="Description" error={errors.description} className="sm:col-span-2">
                <textarea rows={3} placeholder="What does this company do?" {...fieldProps("description", "onboard-description")} />
              </FormField>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="font-bold text-xs text-[#1c1b23] uppercase tracking-wider mb-3">
              Administrator Account
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="onboard-first-name" label="First name" required error={errors.adminFirstName}>
                <input type="text" {...fieldProps("adminFirstName", "onboard-first-name")} />
              </FormField>
              <FormField id="onboard-last-name" label="Last name" required error={errors.adminLastName}>
                <input type="text" {...fieldProps("adminLastName", "onboard-last-name")} />
              </FormField>
              <FormField id="onboard-admin-email" label="Administrator email" required error={errors.adminEmail} className="sm:col-span-2">
                <input type="email" placeholder="admin@acme.com" autoComplete="off" {...fieldProps("adminEmail", "onboard-admin-email")} />
              </FormField>
              <FormField id="onboard-password" label="Temporary password" required error={errors.password}>
                <input type={passwordVisible ? "text" : "password"} autoComplete="new-password" {...fieldProps("password", "onboard-password")} />
              </FormField>
              <FormField id="onboard-confirm-password" label="Confirm password" required error={errors.confirmPassword}>
                <input type={passwordVisible ? "text" : "password"} autoComplete="new-password" {...fieldProps("confirmPassword", "onboard-confirm-password")} />
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-[#474555] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={passwordVisible}
                onChange={(event) => setPasswordVisible(event.target.checked)}
                className="accent-[#6D5EF5]"
              />
              Show passwords
            </label>
            <p className="text-[11px] text-[#787586]">
              8–128 characters with uppercase, lowercase, number, and symbol. Share it with the company administrator so they can sign in with company login.
            </p>
          </fieldset>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#e2e4e9] bg-[#fbfbfe] flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-white border border-[#e2e4e9] font-bold text-xs text-[#474555] hover:bg-[#f6f2ff] hover:text-[#1c1b23] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-[#6D5EF5] hover:bg-[#5b4be8] text-white font-bold text-xs transition-all shadow-md shadow-[#6D5EF5]/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-sm">{saving ? "progress_activity" : "add_business"}</span>
            {saving ? "Onboarding…" : "Onboard Company"}
          </button>
        </div>
      </form>
    </div>
  );
}
