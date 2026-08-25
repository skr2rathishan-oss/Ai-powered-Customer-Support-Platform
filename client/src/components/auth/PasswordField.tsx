interface PasswordFieldProps {
  id: string;
  value: string;
  visible: boolean;
  disabled?: boolean;
  error?: string;
  label?: string;
  autoComplete?: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
}

export function PasswordField({
  id,
  value,
  visible,
  disabled = false,
  error,
  label = "Password",
  autoComplete = "current-password",
  onBlur,
  onChange,
  onToggleVisibility,
}: PasswordFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="field-group">
      <div className="field-group__header">
        <label htmlFor={id}>{label}</label>
      </div>
      <div className="password-input-wrap">
        <input
          id={id}
          className={error ? "input input--error" : "input"}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="••••••••"
          value={value}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="password-toggle-btn"
          type="button"
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          disabled={disabled}
          onClick={onToggleVisibility}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

