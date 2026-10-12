import { useNavigate } from "react-router";
import { AuthShell } from "../../components/auth/AuthShell";
import { CompanyRegistrationForm } from "../../components/auth/CompanyRegistrationForm";
import { RegistrationClosedNotice } from "../../components/auth/RegistrationClosedNotice";
import { usePlatformSettings } from "../../components/common/platformSettingsContext";
import { ROUTES } from "../../router/routes";
import { useRedirectIfSignedIn } from "../../router/useRedirectIfSignedIn";

export function CompanyRegisterPage() {
  const navigate = useNavigate();
  useRedirectIfSignedIn();
  const { allowSelfRegistration } = usePlatformSettings();

  return (
    <AuthShell registration>
      {!allowSelfRegistration ? (
        <RegistrationClosedNotice />
      ) : (
        <CompanyRegistrationForm
          onAuthenticated={() =>
            navigate(ROUTES.DASHBOARD_COMPANY, { replace: true })
          }
        />
      )}
    </AuthShell>
  );
}

