import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthShell } from "../../components/auth/AuthShell";
import { PasswordField } from "../../components/auth/PasswordField";
import { ROUTES } from "../../router/routes";
import {
  AuthenticationError,
  resetPassword,
  verifyResetToken,
} from "../../services/auth";

const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])[\s\S]{8,128}$/;

function calculatePasswordStrength(pass: string): {
  score: number;
  label: string;
  colorClass: string;
} {
  if (!pass) return { score: 0, label: "", colorClass: "bg-slate-200" };

  let score = 0;
  if (pass.length >= 8) score += 1;
  if (pass.length >= 12) score += 1;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
  if (/\d/.test(pass)) score += 1;
  if (/[^A-Za-z0-9\s]/.test(pass)) score += 1;

  if (score <= 2) {
    return { score: 1, label: "Weak", colorClass: "bg-rose-500" };
  }
  if (score === 3) {
    return { score: 2, label: "Fair", colorClass: "bg-amber-500" };
  }
  if (score === 4) {
    return { score: 3, label: "Good", colorClass: "bg-blue-500" };
  }
  return { score: 4, label: "Strong", colorClass: "bg-emerald-500" };
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = (
    searchParams.get("token") ||
    new URLSearchParams(window.location.search).get("token") ||
    ""
  ).trim();

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [tokenError, setTokenError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setTokenError("Missing password reset token. Please request a new link.");
      return;
    }

    let active = true;
    verifyResetToken(token)
      .then((data) => {
        if (active) {
          setTokenValid(true);
          setUserEmail(data.email);
          setVerifying(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setTokenValid(false);
          setTokenError(
            err instanceof AuthenticationError
              ? err.message
              : "This password reset link is invalid or has expired.",
          );
          setVerifying(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  const strength = calculatePasswordStrength(password);

  function validate(): boolean {
    const nextErrors: { password?: string; confirmPassword?: string } = {};

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (!PASSWORD_PATTERN.test(password)) {
      nextErrors.password =
        "Use 8+ characters with uppercase, lowercase, number, and symbol.";
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError("");

    if (!validate()) return;

    setLoading(true);
    try {
      await resetPassword(token, password);
      setIsSuccess(true);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof AuthenticationError
          ? err.message
          : "Failed to reset password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      {verifying ? (
        <div className="flex flex-col items-center justify-center p-8 text-center panel-enter">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
            <span className="spinner" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2 font-display">
            Verifying reset link…
          </h2>
          <p className="text-sm text-on-surface-variant">
            Please wait while we validate your security token.
          </p>
        </div>
      ) : isSuccess ? (
        <div className="forgot-success-card p-6 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col items-center text-center panel-enter">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-xs">
            <span className="material-symbols-outlined text-2xl">
              check_circle
            </span>
          </div>
          <h3 className="font-bold text-xl text-on-surface mb-1 font-display">
            Password reset successful!
          </h3>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
            Your password has been updated. You can now sign in to your SupportPilot account with your new credentials.
          </p>
          <button
            type="button"
            className="submit-button w-full"
            onClick={() => navigate(ROUTES.LOGIN)}
          >
            Return to Sign In
          </button>
        </div>
      ) : !tokenValid ? (
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col items-center text-center panel-enter">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3 shadow-xs">
            <span className="material-symbols-outlined text-2xl">
              error_outline
            </span>
          </div>
          <h3 className="font-bold text-lg text-on-surface mb-1 font-display">
            Invalid or expired link
          </h3>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
            {tokenError ||
              "This password reset link is invalid or has expired. For your security, reset links expire after 15 minutes."}
          </p>
          <div className="flex flex-col gap-2.5 w-full">
            <Link
              to={ROUTES.LOGIN}
              className="submit-button w-full text-center inline-block no-underline"
            >
              Request New Reset Link
            </Link>
          </div>
        </div>
      ) : (
        <div className="panel-enter" role="region" aria-label="Reset password form">
          <div className="forgot-header mb-6">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-3 shadow-xs border border-primary/20">
              <span className="material-symbols-outlined text-2xl">
                lock_reset
              </span>
            </div>
            <h2 className="text-2xl font-bold text-on-surface mb-1.5 font-display tracking-tight">
              Create new password
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {userEmail ? (
                <>
                  Setting a new password for{" "}
                  <strong className="text-on-surface font-semibold">
                    {userEmail}
                  </strong>
                  .
                </>
              ) : (
                "Enter your new password below."
              )}
            </p>
          </div>

          {submitError ? (
            <div className="banner banner--error mb-4" role="alert">
              <span className="material-symbols-outlined text-base">warning</span>
              <p>{submitError}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <PasswordField
                id="reset-new-password"
                label="New Password"
                value={password}
                visible={passwordVisible}
                disabled={loading}
                error={fieldErrors.password}
                autoComplete="new-password"
                onBlur={() => {
                  if (password) {
                    setFieldErrors((curr) => ({
                      ...curr,
                      password: PASSWORD_PATTERN.test(password)
                        ? undefined
                        : "Use 8+ characters with uppercase, lowercase, number, and symbol.",
                    }));
                  }
                }}
                onChange={(val) => {
                  setPassword(val);
                  if (fieldErrors.password) {
                    setFieldErrors((curr) => ({ ...curr, password: undefined }));
                  }
                  if (submitError) setSubmitError("");
                }}
                onToggleVisibility={() => setPasswordVisible(!passwordVisible)}
              />

              {password ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">
                      Password strength:
                    </span>
                    <span className="font-semibold text-on-surface">
                      {strength.label}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex gap-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full flex-1 transition-all duration-300 rounded-full ${
                          strength.score >= step
                            ? strength.colorClass
                            : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <PasswordField
              id="reset-confirm-password"
              label="Confirm New Password"
              value={confirmPassword}
              visible={confirmPasswordVisible}
              disabled={loading}
              error={fieldErrors.confirmPassword}
              autoComplete="new-password"
              onBlur={() => {
                if (confirmPassword && confirmPassword !== password) {
                  setFieldErrors((curr) => ({
                    ...curr,
                    confirmPassword: "Passwords do not match.",
                  }));
                }
              }}
              onChange={(val) => {
                setConfirmPassword(val);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((curr) => ({
                    ...curr,
                    confirmPassword: undefined,
                  }));
                }
                if (submitError) setSubmitError("");
              }}
              onToggleVisibility={() =>
                setConfirmPasswordVisible(!confirmPasswordVisible)
              }
            />

            <button
              className="submit-button w-full mt-2"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Updating password…
                </>
              ) : (
                "Reset Password"
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                to={ROUTES.LOGIN}
                className="text-xs text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1 font-semibold"
              >
                <span className="material-symbols-outlined text-sm">
                  arrow_back
                </span>
                Back to Sign In
              </Link>
            </div>
          </form>
        </div>
      )}
    </AuthShell>
  );
}

