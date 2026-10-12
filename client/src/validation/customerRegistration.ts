import type { PasswordPolicy } from "../types/auth";
import { passwordMatchesPolicy, passwordPolicyHint } from "./passwordPolicy";
import type {
  CustomerRegistrationErrors,
  CustomerRegistrationField,
  CustomerRegistrationValues,
} from "../types/customer";

const EMAIL_PATTERN =
  /^(?!.*\.\.)[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;

export function validateCustomerRegistrationField(
  field: CustomerRegistrationField,
  values: CustomerRegistrationValues,
  policy?: PasswordPolicy,
): string | undefined {
  const value = values[field];
  const trimmed = value.trim();

  switch (field) {
    case "companyId":
      return /^[1-9]\d*$/.test(trimmed) ? undefined : "Select a company.";
    case "firstName":
    case "lastName": {
      const label = field === "firstName" ? "First name" : "Last name";
      if (!trimmed) return `${label} is required.`;
      if (trimmed.length > 60 || !NAME_PATTERN.test(trimmed)) {
        return `${label} may contain letters, spaces, apostrophes, and hyphens (up to 60).`;
      }
      return undefined;
    }
    case "email":
      if (!trimmed) return "Email is required.";
      if (trimmed.length > 254 || !EMAIL_PATTERN.test(trimmed)) {
        return "Enter a valid email address.";
      }
      return undefined;
    case "password":
      if (!value) return "Password is required.";
      if (!passwordMatchesPolicy(value, policy)) {
        return passwordPolicyHint(policy);
      }
      return undefined;
    case "confirmPassword":
      if (!value) return "Confirm your password.";
      return value !== values.password ? "Passwords do not match." : undefined;
  }
}

export function validateCustomerRegistrationForm(
  values: CustomerRegistrationValues,
  policy?: PasswordPolicy,
): CustomerRegistrationErrors {
  return (Object.keys(values) as CustomerRegistrationField[]).reduce(
    (errors, field) => {
      const message = validateCustomerRegistrationField(field, values, policy);
      if (message) errors[field] = message;
      return errors;
    },
    {} as CustomerRegistrationErrors,
  );
}
