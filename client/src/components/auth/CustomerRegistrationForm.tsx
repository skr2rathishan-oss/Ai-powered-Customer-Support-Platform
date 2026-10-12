import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ApiError } from "../../services/apiClient";
import {
  getFieldErrors,
  listPublicCompanies,
  registerCustomer,
} from "../../services/customer";
import { ROUTES } from "../../router/routes";
import type {
  CustomerRegistrationErrors,
  CustomerRegistrationField,
  CustomerRegistrationValues,
  PublicCompany,
} from "../../types/customer";
import {
  validateCustomerRegistrationField,
  validateCustomerRegistrationForm,
} from "../../validation/customerRegistration";
import { PasswordField } from "./PasswordField";
import { usePlatformSettings } from "../common/platformSettingsContext";
import { passwordPolicyHint } from "../../validation/passwordPolicy";
import { RegistrationField } from "./RegistrationField";

interface CustomerRegistrationFormProps {
  onAuthenticated: () => void;
}

const initialValues: CustomerRegistrationValues = {
  companyId: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

type CompaniesState =
  | { status: "loading" }
  | { status: "ready"; companies: PublicCompany[] }
  | { status: "error"; message: string };

export function CustomerRegistrationForm({
  onAuthenticated,
}: CustomerRegistrationFormProps) {
  const { passwordPolicy } = usePlatformSettings();
  const [values, setValues] = useState<CustomerRegistrationValues>(initialValues);
  const [errors, setErrors] = useState<CustomerRegistrationErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [companies, setCompanies] = useState<CompaniesState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listPublicCompanies()
      .then((list) => {
        if (!cancelled) setCompanies({ status: "ready", companies: list });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCompanies({
          status: "error",
          message:
            error instanceof Error ? error.message : "Could not load companies.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  function updateField<K extends CustomerRegistrationField>(
    key: K,
    value: CustomerRegistrationValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError("");
  }

  function handleBlur(field: CustomerRegistrationField) {
    setErrors((current) => ({
      ...current,
      [field]: validateCustomerRegistrationField(field, values, passwordPolicy),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    const nextErrors = validateCustomerRegistrationForm(values, passwordPolicy);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    setSubmitError("");
    try {
      await registerCustomer(values);
      onAuthenticated();
    } catch (error) {
      const fieldErrors: CustomerRegistrationErrors = {};
      for (const item of getFieldErrors422(error)) {
        if (item.field in initialValues) {
          fieldErrors[item.field as CustomerRegistrationField] = item.message;
        }
      }
      setErrors(fieldErrors);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Registration failed. Please try again.",
      );
      setLoading(false);
    }
  }

  const companyList = companies.status === "ready" ? companies.companies : [];

  return (
    <form className="registration-form" onSubmit={handleSubmit} noValidate>
      <div className="registration-header">
        <h1 className="registration-title">Create a customer account</h1>
        <p className="registration-subtitle">
          Sign up to submit support tickets and track their progress.
        </p>
      </div>

      <fieldset className="form-section">
        <legend className="form-section__title">Your company</legend>
        <div className="form-grid">
          <div className="field-group form-grid--full">
            <label htmlFor="customer-company">Company *</label>
            <select
              id="customer-company"
              className={errors.companyId ? "input input--error" : "input"}
              value={values.companyId}
              disabled={loading || companies.status !== "ready"}
              aria-invalid={Boolean(errors.companyId)}
              onBlur={() => handleBlur("companyId")}
              onChange={(event) => updateField("companyId", event.target.value)}
            >
              <option value="">
                {companies.status === "loading"
                  ? "Loading companies..."
                  : "Select a company"}
              </option>
              {companyList.map((company) => (
                <option key={company.companyId} value={String(company.companyId)}>
                  {company.companyName}
                </option>
              ))}
            </select>
            {errors.companyId ? (
              <p className="field-error" role="alert">
                {errors.companyId}
              </p>
            ) : null}
            {companies.status === "error" ? (
              <p className="field-error" role="alert">
                {companies.message}{" "}
                <button
                  type="button"
                  className="underline cursor-pointer"
                  onClick={() => {
                    setCompanies({ status: "loading" });
                    setReloadToken((n) => n + 1);
                  }}
                >
                  Retry
                </button>
              </p>
            ) : null}
            {companies.status === "ready" && companyList.length === 0 ? (
              <p className="field-hint">No companies are accepting customers yet.</p>
            ) : null}
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend className="form-section__title">Your account</legend>
        <div className="form-grid">
          <RegistrationField
            id="customer-first-name"
            label="First Name *"
            autoComplete="given-name"
            value={values.firstName}
            disabled={loading}
            error={errors.firstName}
            onBlur={() => handleBlur("firstName")}
            onChange={(e) => updateField("firstName", e.target.value)}
          />
          <RegistrationField
            id="customer-last-name"
            label="Last Name *"
            autoComplete="family-name"
            value={values.lastName}
            disabled={loading}
            error={errors.lastName}
            onBlur={() => handleBlur("lastName")}
            onChange={(e) => updateField("lastName", e.target.value)}
          />
          <RegistrationField
            id="customer-email"
            label="Email Address *"
            type="email"
            autoComplete="email"
            className="form-grid--full"
            value={values.email}
            disabled={loading}
            error={errors.email}
            onBlur={() => handleBlur("email")}
            onChange={(e) => updateField("email", e.target.value)}
          />
          <div>
            <PasswordField
              id="customer-password"
              hint={passwordPolicyHint(passwordPolicy)}
              label="Password *"
              autoComplete="new-password"
              value={values.password}
              visible={passwordVisible}
              disabled={loading}
              error={errors.password}
              onBlur={() => handleBlur("password")}
              onChange={(value) => updateField("password", value)}
              onToggleVisibility={() => setPasswordVisible((v) => !v)}
            />
          </div>
          <div>
            <PasswordField
              id="customer-confirm-password"
              label="Confirm Password *"
              autoComplete="new-password"
              value={values.confirmPassword}
              visible={confirmVisible}
              disabled={loading}
              error={errors.confirmPassword}
              onBlur={() => handleBlur("confirmPassword")}
              onChange={(value) => updateField("confirmPassword", value)}
              onToggleVisibility={() => setConfirmVisible((v) => !v)}
            />
          </div>
        </div>
      </fieldset>

      {submitError ? (
        <div className="form-message form-message--error" role="alert">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 17h.01" />
          </svg>
          <span>{submitError}</span>
        </div>
      ) : null}

      <button className="submit-button" type="submit" disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Creating account…
          </>
        ) : (
          "Create account"
        )}
      </button>

      <div className="company-register-prompt">
        <span>Already have an account?</span>
        <Link to={ROUTES.LOGIN}>Sign in here</Link>
      </div>
    </form>
  );
}

function getFieldErrors422(error: unknown) {
  if (!(error instanceof ApiError)) return [];
  // 422 field errors and the 409 duplicate-email error both carry `errors`
  const payload = error.payload as { errors?: unknown } | null | undefined;
  if (!payload || !Array.isArray(payload.errors)) return getFieldErrors(error);
  return payload.errors.filter(
    (item): item is { field: string; message: string } =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { field?: unknown }).field === "string" &&
      typeof (item as { message?: unknown }).message === "string",
  );
}
