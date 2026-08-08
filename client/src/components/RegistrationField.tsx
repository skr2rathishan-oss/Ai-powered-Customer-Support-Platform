import type { ChangeEventHandler } from "react";

interface RegistrationFieldProps {
  id: string;
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  required?: boolean;
  type?: "text" | "email" | "tel" | "url";
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  options?: readonly string[];
  onBlur: () => void;
  onChange: (value: string) => void;
}

export function RegistrationField({
  id,
  label,
  value,
  error,
  disabled,
  required = false,
  type = "text",
  autoComplete,
  placeholder,
  maxLength,
  multiline = false,
  options,
  onBlur,
  onChange,
}: RegistrationFieldProps) {
  const errorId = `${id}-error`;
  const commonProps = {
    id,
    className: error ? "input input--error" : "input",
    value,
    disabled,
    required,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? errorId : undefined,
    onBlur,
  };
  const handleChange: ChangeEventHandler<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  > = (event) => onChange(event.target.value);

  return (
    <div className="field-group">
      <label htmlFor={id}>
        {label}
        {!required ? <span className="optional-label"> Optional</span> : null}
      </label>

      {options ? (
        <select {...commonProps} onChange={handleChange}>
          <option value="">Select an industry</option>
          {options.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      ) : multiline ? (
        <textarea
          {...commonProps}
          className={`${commonProps.className} registration-textarea`}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={handleChange}
        />
      ) : (
        <input
          {...commonProps}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={handleChange}
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
