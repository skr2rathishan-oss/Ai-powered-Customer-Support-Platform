import { NavLink } from "react-router";
import type { LoginMode } from "../../types/auth";
import { ROUTES } from "../../router/routes";

interface AuthToggleProps {
  activeMode: LoginMode;
  disabled?: boolean;
}

const options: Array<{
  label: string;
  mode: LoginMode;
  path: string;
  ariaLabel: string;
}> = [
  {
    label: "Individual",
    mode: "individual",
    path: ROUTES.LOGIN,
    ariaLabel: "Individual Sign In",
  },
  {
    label: "Company",
    mode: "company",
    path: ROUTES.LOGIN_COMPANY,
    ariaLabel: "Company Sign In",
  },
];

export function AuthToggle({
  activeMode,
  disabled = false,
}: AuthToggleProps) {
  return (
    <div className="auth-toggle" role="tablist" aria-label="Choose sign-in type">
      <span
        className="auth-toggle__indicator"
        data-position={activeMode}
        aria-hidden="true"
      />
      {options.map(({ label, mode, path, ariaLabel }) => (
        <NavLink
          className="auth-toggle__option"
          data-active={activeMode === mode}
          to={path}
          end
          role="tab"
          aria-label={ariaLabel}
          aria-selected={activeMode === mode}
          aria-disabled={disabled}
          aria-controls={`${mode}-login-panel`}
          tabIndex={disabled ? -1 : undefined}
          key={mode}
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
        >
          {label}
        </NavLink>
      ))}
    </div>
  );
}

