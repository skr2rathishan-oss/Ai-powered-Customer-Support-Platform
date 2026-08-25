import { useEffect, useRef, useState } from "react";
import { requestPasswordReset } from "../../services/auth";
import type { LoginMode } from "../../types/auth";

interface ForgotPasswordDialogProps {
  mode: LoginMode;
  initialEmail: string;
  onClose: () => void;
}

export function ForgotPasswordDialog({
  mode,
  initialEmail,
  onClose,
}: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await requestPasswordReset(cleanEmail);
      setSubmitted(true);
    } catch {
      setError("Could not submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-title"
      >
        <button
          className="dialog-close-btn"
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="dialog-title" id="forgot-title">
          Reset Password
        </h2>
        <p className="dialog-description">
          {mode === "company"
            ? "Enter your company business email and we'll send a recovery link."
            : "Enter your registered email and we'll send you instructions."}
        </p>

        {submitted ? (
          <div className="dialog-success">
            <p>
              If an account matches <strong>{email}</strong>, a password reset
              link has been sent.
            </p>
            <button
              className="submit-button"
              type="button"
              onClick={onClose}
              style={{ marginTop: 16 }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="forgot-email">Email Address</label>
              <input
                id="forgot-email"
                ref={inputRef}
                className={error ? "input input--error" : "input"}
                type="email"
                placeholder="name@example.com"
                value={email}
                disabled={loading}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
              />
              {error ? <p className="field-error">{error}</p> : null}
            </div>

            <div className="dialog-actions">
              <button
                className="btn-secondary"
                type="button"
                disabled={loading}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="submit-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

