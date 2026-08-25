import { useState } from "react";
import { Link } from "react-router";
import { AuthenticationError, registerCompany } from "../../services/auth";
import type {
  CompanyRegistrationErrors,
  CompanyRegistrationField,
  CompanyRegistrationValues,
} from "../../types/auth";
import {
  INDUSTRIES,
  validateRegistrationField,
  validateRegistrationForm,
} from "../../validation/companyRegistration";
import { PasswordField } from "./PasswordField";
import { RegistrationField } from "./RegistrationField";
import { ROUTES } from "../../router/routes";

interface CompanyRegistrationFormProps {
  onAuthenticated: () => void;
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

export function CompanyRegistrationForm({
  onAuthenticated,
}: CompanyRegistrationFormProps) {
  const [values, setValues] =
    useState<CompanyRegistrationValues>(initialValues);
  const [errors, setErrors] = useState<CompanyRegistrationErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  function updateField<K extends CompanyRegistrationField>(
    key: K,
    value: CompanyRegistrationValues[K],
  ) {
    setValues((curr) => ({ ...curr, [key]: value }));
    setErrors((curr) => ({ ...curr, [key]: undefined }));
    setSubmitError("");
  }

  function handleBlur(field: CompanyRegistrationField) {
    const message = validateRegistrationField(field, values);
    setErrors((curr) => ({ ...curr, [field]: message }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validateRegistrationForm(values);
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setLoading(true);
    setSubmitError("");
    setSuccessMessage("");

    try {
      const payload = {
        companyName: values.companyName,
        industry: values.industry,
        businessEmail: values.businessEmail,
        phone: values.phone,
        website: values.website,
        description: values.description,
        adminFirstName: values.adminFirstName,
        adminLastName: values.adminLastName,
        adminEmail: values.adminEmail,
        password: values.password,
      };
      const result = await registerCompany(payload);
      setSuccessMessage(
        result.message ?? "Company workspace registered successfully!",
      );
      setTimeout(() => {
        onAuthenticated();
      }, 1200);
    } catch (err) {
      if (err instanceof AuthenticationError) {
        setSubmitError(err.message);
        if (err.fieldErrors) setErrors(err.fieldErrors);
      } else {
        setSubmitError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="registration-form" onSubmit={handleSubmit} noValidate>
      <div className="registration-header">
        <h1 className="registration-title">Register your company</h1>
        <p className="registration-subtitle">
          Set up an enterprise AI customer support workspace for your team.
        </p>
      </div>

      <fieldset className="form-section">
        <legend className="form-section__title">Company Information</legend>
        <div className="form-grid">
          <RegistrationField
            id="company-name"
            label="Company Name *"
            placeholder="Acme Corp"
            value={values.companyName}
            disabled={loading}
            error={errors.companyName}
            onBlur={() => handleBlur("companyName")}
            onChange={(e) => updateField("companyName", e.target.value)}
          />
          
          <div className="field-group">
            <label htmlFor="industry">Industry *</label>
            <select
              id="industry"
              className={errors.industry ? "input input--error" : "input"}
              value={values.industry}
              disabled={loading}
              onBlur={() => handleBlur("industry")}
              onChange={(e) => updateField("industry", e.target.value)}
            >
              <option value="">Select an industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
            {errors.industry && (
              <p className="field-error" role="alert">
                {errors.industry}
              </p>
            )}
          </div>

          <RegistrationField
            id="business-email"
            label="Business Email *"
            type="email"
            placeholder="contact@acme.com"
            value={values.businessEmail}
            disabled={loading}
            error={errors.businessEmail}
            onBlur={() => handleBlur("businessEmail")}
            onChange={(e) => updateField("businessEmail", e.target.value)}
          />
          <RegistrationField
            id="phone"
            label="Phone Number"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={values.phone}
            disabled={loading}
            error={errors.phone}
            onBlur={() => handleBlur("phone")}
            onChange={(e) => updateField("phone", e.target.value)}
          />
          <RegistrationField
            id="website"
            label="Website"
            type="url"
            placeholder="https://acme.com"
            className="form-grid--full"
            value={values.website}
            disabled={loading}
            error={errors.website}
            onBlur={() => handleBlur("website")}
            onChange={(e) => updateField("website", e.target.value)}
          />
          <RegistrationField
            id="description"
            label="Company Description"
            isTextarea
            placeholder="Brief overview of your company and support needs"
            className="form-grid--full"
            value={values.description}
            disabled={loading}
            error={errors.description}
            onBlur={() => handleBlur("description")}
            onChange={(e) => updateField("description", e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend className="form-section__title">Admin Account</legend>
        <div className="form-grid">
          <RegistrationField
            id="admin-first-name"
            label="First Name *"
            placeholder="Alex"
            value={values.adminFirstName}
            disabled={loading}
            error={errors.adminFirstName}
            onBlur={() => handleBlur("adminFirstName")}
            onChange={(e) => updateField("adminFirstName", e.target.value)}
          />
          <RegistrationField
            id="admin-last-name"
            label="Last Name *"
            placeholder="Morgan"
            value={values.adminLastName}
            disabled={loading}
            error={errors.adminLastName}
            onBlur={() => handleBlur("adminLastName")}
            onChange={(e) => updateField("adminLastName", e.target.value)}
          />
          <RegistrationField
            id="admin-email"
            label="Admin Email Address *"
            type="email"
            placeholder="alex@acme.com"
            className="form-grid--full"
            value={values.adminEmail}
            disabled={loading}
            error={errors.adminEmail}
            onBlur={() => handleBlur("adminEmail")}
            onChange={(e) => updateField("adminEmail", e.target.value)}
          />
          <div>
            <PasswordField
              id="password"
              label="Admin Password *"
              autoComplete="new-password"
              value={values.password}
              visible={passwordVisible}
              disabled={loading}
              error={errors.password}
              onBlur={() => handleBlur("password")}
              onChange={(pass) => updateField("password", pass)}
              onToggleVisibility={() => setPasswordVisible((v) => !v)}
            />
          </div>
          <div>
            <PasswordField
              id="confirm-password"
              label="Confirm Password *"
              autoComplete="new-password"
              value={values.confirmPassword}
              visible={confirmPasswordVisible}
              disabled={loading}
              error={errors.confirmPassword}
              onBlur={() => handleBlur("confirmPassword")}
              onChange={(pass) => updateField("confirmPassword", pass)}
              onToggleVisibility={() => setConfirmPasswordVisible((v) => !v)}
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

      {successMessage ? (
        <div className="form-message form-message--success" role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12l2.6 2.6L16.5 9" />
          </svg>
          <span>{successMessage}</span>
        </div>
      ) : null}

      <button className="submit-button" type="submit" disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Creating Workspace…
          </>
        ) : (
          "Complete Registration"
        )}
      </button>

      <div className="company-register-prompt">
        <span>Already have an account?</span>
        <Link to={ROUTES.LOGIN_COMPANY}>Sign in here</Link>
      </div>
    </form>
  );
}

