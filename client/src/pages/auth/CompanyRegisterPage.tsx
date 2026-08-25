import { useNavigate } from "react-router";
import { AuthShell } from "../../components/auth/AuthShell";
import { CompanyRegistrationForm } from "../../components/auth/CompanyRegistrationForm";
import { ROUTES } from "../../router/routes";

export function CompanyRegisterPage() {
  const navigate = useNavigate();

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

