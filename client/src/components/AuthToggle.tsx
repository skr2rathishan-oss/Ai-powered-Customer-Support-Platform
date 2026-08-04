import type { LoginMode } from "../types/auth";

interface AuthToggleProps {
  activeMode: LoginMode;
  disabled?: boolean;
  onChange: (mode: LoginMode) => void;
}

const options: Array<{ label: string; mode: LoginMode; ariaLabel: string }> = [
  { label: "Individual", mode: "individual", ariaLabel: "Individual Sign In" },
  { label: "Company", mode: "company", ariaLabel: "Company Sign In" },
];

export function AuthToggle({
  activeMode,
  disabled = false,
  onChange,
}: AuthToggleProps) {
  return (
    <div className="auth-toggle" role="tablist" aria-label="Choose sign-in type">
      <span
        className="auth-toggle__indicator"
        data-position={activeMode}
        aria-hidden="true"
      />
      {options.map(({ label, mode, ariaLabel }) => (
        <button
          className="auth-toggle__option"
          data-active={activeMode === mode}
          type="button"
          role="tab"
          aria-label={ariaLabel}
          aria-selected={activeMode === mode}
          aria-controls={`${mode}-login-panel`}
          disabled={disabled}
          key={mode}
          onClick={() => onChange(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
