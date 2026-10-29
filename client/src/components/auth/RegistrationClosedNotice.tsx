import { Link } from "react-router";
import { ROUTES } from "../../router/routes";

/** Shown instead of a sign-up form while self-registration is switched off. */
export function RegistrationClosedNotice() {
  return (
    <div
      className="form-message form-message--error"
      role="status"
      data-testid="registration-closed"
    >
      <p style={{ margin: 0, fontWeight: 600 }}>Registration is closed</p>
      <p style={{ margin: "4px 0 0" }}>
        New accounts are not being accepted right now. If you already have an
        account, <Link to={ROUTES.LOGIN}>sign in</Link>.
      </p>
    </div>
  );
}
