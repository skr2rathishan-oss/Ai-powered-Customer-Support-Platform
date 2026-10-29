import { useNavigate } from "react-router";
import { AuthShell } from "../../components/auth/AuthShell";
import { CustomerRegistrationForm } from "../../components/auth/CustomerRegistrationForm";
import { RegistrationClosedNotice } from "../../components/auth/RegistrationClosedNotice";
import { usePlatformSettings } from "../../components/common/platformSettingsContext";
import { ROUTES } from "../../router/routes";
import { useRedirectIfSignedIn } from "../../router/useRedirectIfSignedIn";

export function CustomerRegisterPage() {
  const navigate = useNavigate();
  useRedirectIfSignedIn();
  const { allowSelfRegistration } = usePlatformSettings();

  return (
    <AuthShell registration>
      {!allowSelfRegistration ? (
        <RegistrationClosedNotice />
      ) : (
        <CustomerRegistrationForm
          onAuthenticated={() =>
            navigate(ROUTES.CUSTOMER_TICKETS, { replace: true })
          }
        />
      )}
    </AuthShell>
  );
}
