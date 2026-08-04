import { useCallback, useMemo, useState } from "react";
import { AuthToggle } from "./components/AuthToggle";
import { ForgotPasswordDialog } from "./components/ForgotPasswordDialog";
import { LoginForm } from "./components/LoginForm";
import { ProductShowcase } from "./components/ProductShowcase";
import { loginCompany, loginIndividual } from "./services/auth";
import type {
  LoginFormErrors,
  LoginFormValues,
  LoginMode,
} from "./types/auth";

const EMAIL_PATTERN =
  /^(?!.*\.\.)[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])[\s\S]{8,128}$/;

const STORAGE_KEYS: Record<LoginMode, string> = {
  individual: "supportpilot.rememberedEmail.individual",
  company: "supportpilot.rememberedEmail.company",
};

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

function App() {
  const [activeMode, setActiveMode] = useState<LoginMode>("individual");
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
  const [forgotMode, setForgotMode] = useState<LoginMode | null>(null);

  const activeValues = forms[activeMode];
  const anyLoading = useMemo(
    () => loading.individual || loading.company,
    [loading],
  );

  const closeForgotDialog = useCallback(() => setForgotMode(null), []);

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

  return (
    <main className="auth-page">
      <section className="auth-pane" aria-labelledby="brand-name">
        <div className="auth-pane__glow" aria-hidden="true" />
        <div className="auth-content">
          <a className="brand" href="/" aria-label="SupportPilot home">
            <span className="brand__mark" aria-hidden="true">✦</span>
            <span id="brand-name">SupportPilot</span>
          </a>

          <AuthToggle
            activeMode={activeMode}
            disabled={anyLoading}
            onChange={setActiveMode}
          />

          <div className="form-stage" key={activeMode}>
            <LoginForm
              mode={activeMode}
              values={activeValues}
              errors={errors[activeMode]}
              submitError={submitErrors[activeMode]}
              successMessage={successMessages[activeMode]}
              loading={loading[activeMode]}
              onBlurField={(field) => blurField(activeMode, field)}
              onChange={(patch) => updateForm(activeMode, patch)}
              onForgotPassword={() => setForgotMode(activeMode)}
              onSubmit={() => void submitLogin(activeMode)}
            />
          </div>

          <div className="divider" aria-hidden="true">
            <span>or</span>
          </div>

          <button
            className="google-button"
            type="button"
            onClick={() =>
              setSubmitErrors((current) => ({
                ...current,
                [activeMode]:
                  "Google sign-in is not configured for this project yet.",
              }))
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.6 4.6 0 01-2 3v2.8h3.3c1.9-1.8 2.9-4.4 2.9-7.9z" />
              <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.8c-.9.6-2.1 1-3.4 1a5.9 5.9 0 01-5.5-4.1H3.1v2.9A10 10 0 0012 22z" />
              <path fill="#FBBC05" d="M6.5 13.7a6 6 0 010-3.8V7H3.1a10 10 0 000 9.6l3.4-2.9z" />
              <path fill="#EA4335" d="M12 5.8c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.7 9.7 0 0012 2a10 10 0 00-8.9 5l3.4 2.9A5.9 5.9 0 0112 5.8z" />
            </svg>
            Continue with Google
          </button>

          <p className="legal-copy">
            By continuing, you agree to SupportPilot’s <a href="#terms">Terms of Service</a>{" "}
            and <a href="#privacy">Privacy Policy</a>.
          </p>
        </div>
      </section>

      <ProductShowcase />

      {forgotMode ? (
        <ForgotPasswordDialog
          mode={forgotMode}
          initialEmail={forms[forgotMode].email}
          onClose={closeForgotDialog}
        />
      ) : null}
    </main>
  );
}

export default App;
