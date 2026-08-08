import { Link } from "react-router";
import type {
  LoginFormErrors,
  LoginFormValues,
  LoginMode,
} from "../types/auth";
import { PasswordField } from "./PasswordField";

interface LoginFormProps {
  mode: LoginMode;
  values: LoginFormValues;
  errors: LoginFormErrors;
  submitError?: string;
  successMessage?: string;
  loading: boolean;
  onBlurField: (field: "email" | "password") => void;
  onChange: (patch: Partial<LoginFormValues>) => void;
  onForgotPassword: () => void;
  onSubmit: () => void;
}

export function LoginForm({
  mode,
  values,
  errors,
  submitError,
  successMessage,
  loading,
  onBlurField,
  onChange,
  onForgotPassword,
  onSubmit,
}: LoginFormProps) {
  const emailId = `${mode}-email`;
  const passwordId = `${mode}-password`;
  const emailErrorId = `${emailId}-error`;
  const isCompany = mode === "company";

  return (
    <form
      className="login-form panel-enter"
      id={`${mode}-login-panel`}
      role="tabpanel"
      aria-label={isCompany ? "Company sign in" : "Individual sign in"}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="field-group">
        <label htmlFor={emailId}>
          {isCompany ? "Business Email" : "Email Address"}
        </label>
        <input
          id={emailId}
          className={errors.email ? "input input--error" : "input"}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={isCompany ? "admin@company.com" : "yourname@gmail.com"}
          value={values.email}
          disabled={loading}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? emailErrorId : undefined}
          onBlur={() => onBlurField("email")}
          onChange={(event) => onChange({ email: event.target.value })}
        />
        {errors.email ? (
          <p className="field-error" id={emailErrorId} role="alert">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="password-block">
        <button
          className="forgot-link"
          type="button"
          disabled={loading}
          onClick={onForgotPassword}
        >
          Forgot Password?
        </button>
        <PasswordField
          id={passwordId}
          value={values.password}
          visible={values.passwordVisible}
          disabled={loading}
          error={errors.password}
          onBlur={() => onBlurField("password")}
          onChange={(password) => onChange({ password })}
          onToggleVisibility={() =>
            onChange({ passwordVisible: !values.passwordVisible })
          }
        />
      </div>

      <label className="remember-control">
        <input
          type="checkbox"
          checked={values.rememberMe}
          disabled={loading}
          onChange={(event) => onChange({ rememberMe: event.target.checked })}
        />
        <span className="remember-control__box" aria-hidden="true">
          <svg viewBox="0 0 12 10">
            <path d="M1 5l3 3 7-7" />
          </svg>
        </span>
        <span>Remember Me</span>
      </label>

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
            Signing in…
          </>
        ) : isCompany ? (
          "Company Sign In"
        ) : (
          "Sign In"
        )}
      </button>

      {isCompany ? (
        <div className="company-register-prompt">
          <span>New to SupportPilot?</span>
          <Link to="/company/register">Register now</Link>
        </div>
      ) : null}
    </form>
  );
}
