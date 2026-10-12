import { useNavigate } from "react-router";
import { AuthShell } from "../../components/auth/AuthShell";
import { CompanyRegistrationForm } from "../../components/auth/CompanyRegistrationForm";
import { ROUTES } from "../../router/routes";
import { useRedirectIfSignedIn } from "../../router/useRedirectIfSignedIn";

export function CompanyRegisterPage() {
  const navigate = useNavigate();
  useRedirectIfSignedIn();

  return (
    <AuthShell registration>
      <CompanyRegistrationForm
        onAuthenticated={() =>
          navigate(ROUTES.DASHBOARD_COMPANY, { replace: true })
        }
      />
    </AuthShell>
  );
}

