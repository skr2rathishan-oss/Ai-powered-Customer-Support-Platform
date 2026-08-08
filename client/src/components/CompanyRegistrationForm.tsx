import { useRef, useState } from "react";
import { Link } from "react-router";
import { AuthenticationError, registerCompany } from "../services/auth";
import type {
  AuthUser,
  CompanyRegistrationErrors,
  CompanyRegistrationField,
  CompanyRegistrationValues,
} from "../types/auth";
import {
  INDUSTRIES,
  validateRegistrationField,
  validateRegistrationForm,
} from "../validation/companyRegistration";
import { PasswordField } from "./PasswordField";
import { RegistrationField } from "./RegistrationField";

const INITIAL_VALUES: CompanyRegistrationValues = {
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

interface CompanyRegistrationFormProps {
  onAuthenticated: (user: AuthUser) => void;
}

export function CompanyRegistrationForm({
  onAuthenticated,
}: CompanyRegistrationFormProps) {
  const [values, setValues] =
    useState<CompanyRegistrationValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<CompanyRegistrationErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<CompanyRegistrationField, boolean>>
  >({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submittingRef = useRef(false);

  function updateField(field: CompanyRegistrationField, value: string) {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    setSubmitError("");
    setErrors((current) => {
      const next = { ...current, [field]: undefined };
      if (touched[field]) {
        next[field] = validateRegistrationField(field, nextValues);
      }
      if (field === "password" && touched.confirmPassword) {
        next.confirmPassword = validateRegistrationField(
          "confirmPassword",
          nextValues,
        );
      }
      return next;
    });
  }

  function blurField(field: CompanyRegistrationField) {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({
      ...current,
      [field]: validateRegistrationField(field, values),
    }));
  }

  async function submitRegistration() {
    if (submittingRef.current) return;

    const nextErrors = validateRegistrationForm(values);
    setTouched(
      (Object.keys(values) as CompanyRegistrationField[]).reduce(
        (current, field) => ({ ...current, [field]: true }),
        {},
      ),
    );
    setErrors(nextErrors);
    setSubmitError("");
    if (Object.keys(nextErrors).length > 0) return;

    submittingRef.current = true;
    setLoading(true);
    try {
      const { confirmPassword: _confirmPassword, ...payload } = values;
      void _confirmPassword;
      const result = await registerCompany(payload);
      window.dispatchEvent(
        new CustomEvent("supportpilot:authenticated", {
          detail: { mode: "company", user: result.user },
        }),
      );
      onAuthenticated(result.user);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        setErrors((current) => ({ ...current, ...error.fieldErrors }));
        setSubmitError(error.message);
      } else {
        setSubmitError("Company registration failed. Please try again.");
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <form
      className="registration-form panel-enter"
      noValidate
      aria-busy={loading}
      onSubmit={(event) => {
        event.preventDefault();
        void submitRegistration();
      }}
    >
      <header className="registration-header">
        <h1>Register Your Company</h1>
        <p>Create your workspace and administrator account.</p>
      </header>

      <fieldset disabled={loading}>
        <legend>Company information</legend>
        <div className="registration-grid">
          <RegistrationField id="company-name" label="Company Name" value={values.companyName} error={errors.companyName} disabled={loading} required autoComplete="organization" placeholder="Acme Inc." maxLength={150} onBlur={() => blurField("companyName")} onChange={(value) => updateField("companyName", value)} />
          <RegistrationField id="industry" label="Industry" value={values.industry} error={errors.industry} disabled={loading} required options={INDUSTRIES} onBlur={() => blurField("industry")} onChange={(value) => updateField("industry", value)} />
          <RegistrationField id="business-email" label="Business Email" value={values.businessEmail} error={errors.businessEmail} disabled={loading} required type="email" autoComplete="email" placeholder="contact@company.com" maxLength={150} onBlur={() => blurField("businessEmail")} onChange={(value) => updateField("businessEmail", value)} />
          <RegistrationField id="company-phone" label="Phone" value={values.phone} error={errors.phone} disabled={loading} type="tel" autoComplete="tel" placeholder="+1 555 012 3456" maxLength={20} onBlur={() => blurField("phone")} onChange={(value) => updateField("phone", value)} />
          <div className="registration-grid__full">
            <RegistrationField id="company-website" label="Website" value={values.website} error={errors.website} disabled={loading} type="url" autoComplete="url" placeholder="https://company.com" maxLength={255} onBlur={() => blurField("website")} onChange={(value) => updateField("website", value)} />
          </div>
          <div className="registration-grid__full">
            <RegistrationField id="company-description" label="Description" value={values.description} error={errors.description} disabled={loading} multiline placeholder="Tell us briefly about your company." maxLength={2000} onBlur={() => blurField("description")} onChange={(value) => updateField("description", value)} />
          </div>
        </div>
      </fieldset>

      <fieldset disabled={loading}>
        <legend>Administrator account</legend>
        <div className="registration-grid">
          <RegistrationField id="admin-first-name" label="First Name" value={values.adminFirstName} error={errors.adminFirstName} disabled={loading} required autoComplete="given-name" placeholder="Alex" maxLength={100} onBlur={() => blurField("adminFirstName")} onChange={(value) => updateField("adminFirstName", value)} />
          <RegistrationField id="admin-last-name" label="Last Name" value={values.adminLastName} error={errors.adminLastName} disabled={loading} required autoComplete="family-name" placeholder="Morgan" maxLength={100} onBlur={() => blurField("adminLastName")} onChange={(value) => updateField("adminLastName", value)} />
          <div className="registration-grid__full">
            <RegistrationField id="admin-email" label="Administrator Email" value={values.adminEmail} error={errors.adminEmail} disabled={loading} required type="email" autoComplete="username" placeholder="admin@company.com" maxLength={150} onBlur={() => blurField("adminEmail")} onChange={(value) => updateField("adminEmail", value)} />
          </div>
          <PasswordField id="registration-password" label="Password" value={values.password} visible={passwordVisible} disabled={loading} error={errors.password} autoComplete="new-password" onBlur={() => blurField("password")} onChange={(value) => updateField("password", value)} onToggleVisibility={() => setPasswordVisible((current) => !current)} />
          <PasswordField id="confirm-password" label="Confirm Password" value={values.confirmPassword} visible={confirmPasswordVisible} disabled={loading} error={errors.confirmPassword} autoComplete="new-password" onBlur={() => blurField("confirmPassword")} onChange={(value) => updateField("confirmPassword", value)} onToggleVisibility={() => setConfirmPasswordVisible((current) => !current)} />
        </div>
      </fieldset>

      {submitError ? (
        <div className="form-message form-message--error" role="alert">
          <span>{submitError}</span>
        </div>
      ) : null}

      <button className="submit-button" type="submit" disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Registering company…
          </>
        ) : (
          "Register Company"
        )}
      </button>

      <p className="registration-signin-link">
        Already registered? <Link to="/company">Back to Company Sign In</Link>
      </p>
    </form>
  );
}
