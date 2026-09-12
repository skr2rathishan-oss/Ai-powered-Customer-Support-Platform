import { useState } from "react";
import { AuthenticationError, requestPasswordReset } from "../../services/auth";
import type { LoginMode } from "../../types/auth";

interface ForgotPasswordFormProps {
  mode: LoginMode;
  initialEmail: string;
  onBackToSignIn: () => void;
}

export function ForgotPasswordForm({
  mode,
  initialEmail,
  onBackToSignIn,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const isCompany = mode === "company";
  const emailId = "forgot-password-email";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await requestPasswordReset(cleanEmail);
      setSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof AuthenticationError) {
        setError(err.message);
      } else {
        setError("Could not send password reset link. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="forgot-password-stage panel-enter" role="region" aria-label="Password recovery">
      <button
        type="button"
        onClick={onBackToSignIn}
        className="forgot-back-link mb-6 flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors group cursor-pointer border-0 bg-transparent p-0"
      >
        <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">
          arrow_back
        </span>
        <span>Back to sign in</span>
      </button>

      <div className="forgot-header mb-6">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-3 shadow-xs border border-primary/20">
          <span className="material-symbols-outlined text-2xl">
            lock_reset
          </span>
        </div>
        <h2 className="text-2xl font-bold text-on-surface mb-1.5 font-display tracking-tight">
          Reset password
        </h2>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {isCompany
            ? "Enter your registered business email and we'll send a password recovery link."
            : "Enter your registered email address and we'll send you instructions to regain access."}
        </p>
      </div>

      {submitted ? (
        <div className="forgot-success-card p-6 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-xs">
            <span className="material-symbols-outlined text-2xl">check_circle</span>
          </div>
          <h3 className="font-bold text-lg text-on-surface mb-1">
            Check your inbox
          </h3>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
            If an account matches <strong className="text-on-surface font-semibold">{email}</strong>, a password reset link has been sent.
          </p>
          <div className="flex flex-col gap-2.5 w-full">
            <button
              type="button"
              className="submit-button w-full"
              onClick={onBackToSignIn}
            >
              Return to Sign In
            </button>
            <button
              type="button"
              className="text-xs text-primary font-bold hover:underline py-1.5 bg-transparent border-0 cursor-pointer"
              onClick={() => {
                setSubmitted(false);
                setError("");
              }}
            >
              Didn't receive an email? Click to resend
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="field-group">
            <label htmlFor={emailId}>
              {isCompany ? "Business Email" : "Email Address"}
            </label>
            <input
              id={emailId}
              type="email"
              className={error ? "input input--error" : "input"}
              placeholder={isCompany ? "admin@company.com" : "name@example.com"}
              value={email}
              disabled={loading}
              autoFocus
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
            />
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <button
            className="submit-button w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Sending link…
              </>
            ) : (
              "Send Reset Link"
            )}
          </button>

          <div className="text-center pt-2">
            <span className="text-xs text-on-surface-variant">
              Remember your password?{" "}
              <button
                type="button"
                onClick={onBackToSignIn}
                className="text-primary font-bold hover:underline bg-transparent border-0 p-0 cursor-pointer"
              >
                Sign In
              </button>
            </span>
          </div>
        </form>
      )}
    </div>
  );
}

