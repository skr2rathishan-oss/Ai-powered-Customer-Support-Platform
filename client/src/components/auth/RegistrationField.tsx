import type { InputHTMLAttributes } from "react";

interface RegistrationFieldProps
  extends InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string;
  isTextarea?: boolean;
}

export function RegistrationField({
  id,
  label,
  error,
  isTextarea = false,
  className = "",
  ...rest
}: RegistrationFieldProps) {
  const errorId = `${id}-error`;
  const inputClass = error ? "input input--error" : "input";

  return (
    <div className={`field-group ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      {isTextarea ? (
        <textarea
          id={id}
          className={inputClass}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          rows={3}
          {...(rest as InputHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={id}
          className={inputClass}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

