import { useNavigate } from "react-router";
import { AuthShell } from "../../components/auth/AuthShell";
import { CustomerRegistrationForm } from "../../components/auth/CustomerRegistrationForm";
import { ROUTES } from "../../router/routes";
import { useRedirectIfSignedIn } from "../../router/useRedirectIfSignedIn";

export function CustomerRegisterPage() {
  const navigate = useNavigate();
  useRedirectIfSignedIn();

  return (
    <AuthShell registration>
      <CustomerRegistrationForm
        onAuthenticated={() =>
          navigate(ROUTES.CUSTOMER_TICKETS, { replace: true })
        }
      />
    </AuthShell>
  );
}
