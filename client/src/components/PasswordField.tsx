interface PasswordFieldProps {
  id: string;
  label?: string;
  value: string;
  visible: boolean;
  disabled?: boolean;
  error?: string;
  autoComplete?: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5.7 9 5.7a15 15 0 01-2.2 2.8M6.6 6.7A16 16 0 003 9.7s3.5 5.7 9 5.7c1 0 2-.2 2.9-.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.5-5.7 9-5.7 9 5.7 9 5.7-3.5 5.7-9 5.7S3 12 3 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function PasswordField({
  id,
  label = "Password",
  value,
  visible,
  disabled = false,
  error,
  autoComplete = "current-password",
  onBlur,
  onChange,
  onToggleVisibility,
}: PasswordFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="field-group">
      <div className="password-label-row">
        <label htmlFor={id}>{label}</label>
      </div>
      <div className="password-field">
        <input
          id={id}
          className={error ? "input input--error" : "input"}
          type={visible ? "text" : "password"}
          value={value}
          placeholder="••••••••"
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="password-field__toggle"
          type="button"
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={onToggleVisibility}
        >
          <EyeIcon hidden={visible} />
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
