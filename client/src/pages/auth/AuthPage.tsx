import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthShell } from "../../components/auth/AuthShell";
import { AuthToggle } from "../../components/auth/AuthToggle";
import { ForgotPasswordForm } from "../../components/auth/ForgotPasswordForm";
import { LoginForm } from "../../components/auth/LoginForm";
import { homeForRole } from "../../router/roleRedirect";
import { ROUTES } from "../../router/routes";
import {
  getAuthProviders,
  loginCompany,
  loginIndividual,
} from "../../services/auth";
import { API_BASE_URL } from "../../services/apiClient";
import { useRedirectIfSignedIn } from "../../router/useRedirectIfSignedIn";
import type {
  LoginFormErrors,
  LoginFormValues,
  LoginMode,
} from "../../types/auth";

const EMAIL_PATTERN =
  /^(?!.*\.\.)[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])[\s\S]{8,128}$/;

const STORAGE_KEYS: Record<LoginMode, string> = {
  individual: "supportpilot.rememberedEmail.individual",
  company: "supportpilot.rememberedEmail.company",
};

function googleErrorMessage(code: string): string {
  switch (code) {
    case "google_auth_failed":
      return "Google sign-in failed or was cancelled. Please try again.";
    case "google_no_account":
      return "No SupportPilot account found for that Google email. Register first, then sign in with Google.";
    case "google_inactive":
      return "This account is not active.";
    case "google_role_unsupported":
      return "Google sign-in is not available for this account type. Use company sign-in.";
    case "google_not_configured":
      return "Google sign-in is not available right now.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

function createInitialValues(mode: LoginMode): LoginFormValues {
  const rememberedEmail = localStorage.getItem(STORAGE_KEYS[mode]) ?? "";
  return {
    email: rememberedEmail,
    password: "",
    rememberMe: Boolean(rememberedEmail),
    passwordVisible: false,
  };
}

function validateField(
  field: "email" | "password",
  values: LoginFormValues,
): string | undefined {
  if (field === "email") {
    const email = values.email.trim();
    if (!email) return "Email is required.";
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return "Enter a valid email address.";
    }
    return undefined;
  }

  if (!values.password) return "Password is required.";
  if (!PASSWORD_PATTERN.test(values.password)) {
    return "Use 8+ characters with uppercase, lowercase, number, and symbol.";
  }
  return undefined;
}

function validateForm(values: LoginFormValues): LoginFormErrors {
  return {
    email: validateField("email", values),
    password: validateField("password", values),
  };
}

interface AuthPageProps {
  mode: LoginMode;
}

export function AuthPage({ mode: activeMode }: AuthPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [googleAvailable, setGoogleAvailable] = useState(false);
  useRedirectIfSignedIn();
  const [forms, setForms] = useState<Record<LoginMode, LoginFormValues>>(() => ({
    individual: createInitialValues("individual"),
    company: createInitialValues("company"),
  }));
  const [errors, setErrors] = useState<Record<LoginMode, LoginFormErrors>>({
    individual: {},
    company: {},
  });
  const [submitErrors, setSubmitErrors] = useState<Record<LoginMode, string>>({
    individual: "",
    company: "",
  });
  const [successMessages, setSuccessMessages] = useState<
    Record<LoginMode, string>
  >({ individual: "", company: "" });
  const [loading, setLoading] = useState<Record<LoginMode, boolean>>({
    individual: false,
    company: false,
  });
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  // Surface Google sign-in failures once, then strip the param so a refresh
  // does not show the banner again.
  useEffect(() => {
    const errorCode = searchParams.get("error");
    if (!errorCode) return;

    const message = googleErrorMessage(errorCode);
    setSubmitErrors({ individual: message, company: message });
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("error");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  // Only offer Google when the server says it is configured.
  useEffect(() => {
    let active = true;
    void getAuthProviders().then((providers) => {
      if (active) setGoogleAvailable(providers.google);
    });
    return () => {
      active = false;
    };
  }, []);

  const anyLoading = useMemo(
    () => loading.individual || loading.company,
    [loading],
  );

  function updateForm(mode: LoginMode, patch: Partial<LoginFormValues>) {
    setForms((current) => ({
      ...current,
      [mode]: { ...current[mode], ...patch },
    }));
    setSubmitErrors((current) => ({ ...current, [mode]: "" }));
    setSuccessMessages((current) => ({ ...current, [mode]: "" }));

    const patchedFields = Object.keys(patch);
    setErrors((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        ...(patchedFields.includes("email") ? { email: undefined } : {}),
        ...(patchedFields.includes("password") ? { password: undefined } : {}),
      },
    }));
  }

  function blurField(mode: LoginMode, field: "email" | "password") {
    setErrors((current) => ({
      ...current,
      [mode]: {
        ...current[mode],
        [field]: validateField(field, forms[mode]),
      },
    }));
  }

  async function submitLogin(mode: LoginMode) {
    const values = forms[mode];
    const nextErrors = validateForm(values);
    setErrors((current) => ({ ...current, [mode]: nextErrors }));
    setSubmitErrors((current) => ({ ...current, [mode]: "" }));
    setSuccessMessages((current) => ({ ...current, [mode]: "" }));

    if (nextErrors.email || nextErrors.password) return;

    setLoading((current) => ({ ...current, [mode]: true }));
    try {
      const login = mode === "individual" ? loginIndividual : loginCompany;
      const result = await login({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe,
      });

      if (values.rememberMe) {
        localStorage.setItem(STORAGE_KEYS[mode], values.email.trim().toLowerCase());
      } else {
        localStorage.removeItem(STORAGE_KEYS[mode]);
      }

      setSuccessMessages((current) => ({
        ...current,
        [mode]: `Welcome back, ${result.user.email}.`,
      }));
      window.dispatchEvent(
        new CustomEvent("supportpilot:authenticated", {
          detail: { mode, user: result.user },
        }),
      );

      navigate(
        homeForRole(result.user?.roleName, mode === "company" ? "company" : undefined),
        { replace: true },
      );
    } catch (error) {
      setSubmitErrors((current) => ({
        ...current,
        [mode]:
          error instanceof Error
            ? error.message
            : "Sign in failed. Please try again.",
      }));
    } finally {
      setLoading((current) => ({ ...current, [mode]: false }));
    }
  }

  function handleGoogleSignIn() {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  }

  const activeValues = forms[activeMode];

  return (
    <AuthShell>
      {isForgotPassword ? (
        <ForgotPasswordForm
          mode={activeMode}
          initialEmail={forms[activeMode].email}
          onBackToSignIn={() => setIsForgotPassword(false)}
        />
      ) : (
        <>
          <AuthToggle activeMode={activeMode} disabled={anyLoading} />

          <div className="form-stage" key={activeMode}>
            <LoginForm
              mode={activeMode}
              values={activeValues}
              errors={errors[activeMode]}
              submitError={submitErrors[activeMode]}
              successMessage={successMessages[activeMode]}
              loading={loading[activeMode]}
              onBlurField={(field: "email" | "password") => blurField(activeMode, field)}
              onChange={(patch: Partial<LoginFormValues>) => updateForm(activeMode, patch)}
              onForgotPassword={() => setIsForgotPassword(true)}
              onSubmit={() => void submitLogin(activeMode)}
            />
          </div>

          {googleAvailable && (
            <>
              <div className="divider" aria-hidden="true">
                <span>or</span>
              </div>

              <button
                className="google-button"
                type="button"
                onClick={handleGoogleSignIn}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.6 4.6 0 01-2 3v2.8h3.3c1.9-1.8 2.9-4.4 2.9-7.9z" />
                  <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.8c-.9.6-2.1 1-3.4 1a5.9 5.9 0 01-5.5-4.1H3.1v2.9A10 10 0 0012 22z" />
                  <path fill="#FBBC05" d="M6.5 13.7a6 6 0 010-3.8V7H3.1a10 10 0 000 9.6l3.4-2.9z" />
                  <path fill="#EA4335" d="M12 5.8c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0012 2a10 10 0 00-8.9 5l3.4 2.9A5.9 5.9 0 0112 5.8z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <p className="legal-copy">
            By continuing, you agree to SupportPilot’s <Link to={ROUTES.TERMS}>Terms of Service</Link>{" "}
            and <Link to={ROUTES.PRIVACY}>Privacy Policy</Link>.
          </p>
        </>
      )}
    </AuthShell>
  );
}
