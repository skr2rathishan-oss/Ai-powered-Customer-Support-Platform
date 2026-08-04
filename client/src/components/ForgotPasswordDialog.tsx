import { useEffect, useId, useState } from "react";
import { requestPasswordReset } from "../services/auth";
import type { LoginMode } from "../types/auth";

interface ForgotPasswordDialogProps {
  mode: LoginMode;
  initialEmail: string;
  onClose: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ForgotPasswordDialog({
  mode,
  initialEmail,
  onClose,
}: ForgotPasswordDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [loading, onClose]);

  async function handleSubmit() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(normalizedEmail);
      setSent(true);
    } catch {
      setError("We couldn’t start password recovery. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="forgot-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="dialog-close"
          type="button"
          aria-label="Close password recovery"
          disabled={loading}
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {sent ? (
          <div className="forgot-dialog__success">
            <span className="success-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6 12l4 4 8-9" />
              </svg>
            </span>
            <h2 id={titleId}>Check your inbox</h2>
            <p id={descriptionId}>
              If a {mode} account exists for <strong>{email}</strong>, recovery
              instructions will be sent there.
            </p>
            <button className="submit-button" type="button" onClick={onClose}>
              Back to Sign In
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <span className="dialog-brand-icon" aria-hidden="true">✦</span>
            <h2 id={titleId}>Forgot Password?</h2>
            <p id={descriptionId}>
              Enter your {mode === "company" ? "business " : ""}email and
              we’ll send you instructions to reset your password.
            </p>
            <div className="field-group">
              <label htmlFor="recovery-email">Email Address</label>
              <input
                className={error ? "input input--error" : "input"}
                id="recovery-email"
                type="email"
                autoFocus
                value={email}
                disabled={loading}
                aria-invalid={Boolean(error)}
                onChange={(event) => setEmail(event.target.value)}
              />
              {error ? (
                <p className="field-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <button className="submit-button" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                "Send Instructions"
              )}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
