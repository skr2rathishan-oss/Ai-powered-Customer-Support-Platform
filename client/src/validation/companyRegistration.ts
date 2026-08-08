import type {
  CompanyRegistrationErrors,
  CompanyRegistrationField,
  CompanyRegistrationValues,
} from "../types/auth";

export const INDUSTRIES = [
  "SaaS",
  "E-commerce",
  "Fintech",
  "Healthcare",
  "Education",
  "Other",
] as const;

const EMAIL_PATTERN =
  /^(?!.*\.\.)[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])[\s\S]{8,128}$/;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;
const PHONE_PATTERN = /^\+?[0-9().\-\s]{7,20}$/;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateRegistrationField(
  field: CompanyRegistrationField,
  values: CompanyRegistrationValues,
): string | undefined {
  const value = values[field];
  const trimmed = value.trim();

  switch (field) {
    case "companyName":
      if (!trimmed) return "Company name is required.";
      if (trimmed.length < 2 || trimmed.length > 150) {
        return "Use between 2 and 150 characters.";
      }
      return undefined;
    case "industry":
      if (!trimmed) return "Industry is required.";
      if (!INDUSTRIES.includes(trimmed as (typeof INDUSTRIES)[number])) {
        return "Select a valid industry.";
      }
      return undefined;
    case "businessEmail":
      if (!trimmed) return "Business email is required.";
      if (trimmed.length > 150 || !EMAIL_PATTERN.test(trimmed)) {
        return "Enter a valid business email.";
      }
      return undefined;
    case "phone":
      return trimmed && !PHONE_PATTERN.test(trimmed)
        ? "Enter a valid phone number."
        : undefined;
    case "website":
      return trimmed && (trimmed.length > 255 || !isHttpUrl(trimmed))
        ? "Use a URL beginning with http:// or https://."
        : undefined;
    case "description":
      return trimmed.length > 2000
        ? "Description must not exceed 2000 characters."
        : undefined;
    case "adminFirstName":
    case "adminLastName": {
      const label = field === "adminFirstName" ? "First name" : "Last name";
      if (!trimmed) return `${label} is required.`;
      if (trimmed.length > 100 || !NAME_PATTERN.test(trimmed)) {
        return `${label} may contain letters, spaces, apostrophes, and hyphens.`;
      }
      return undefined;
    }
    case "adminEmail":
      if (!trimmed) return "Administrator email is required.";
      if (trimmed.length > 150 || !EMAIL_PATTERN.test(trimmed)) {
        return "Enter a valid administrator email.";
      }
      return undefined;
    case "password":
      if (!value) return "Password is required.";
      if (!PASSWORD_PATTERN.test(value)) {
        return "Use 8–128 characters with uppercase, lowercase, number, and symbol.";
      }
      return undefined;
    case "confirmPassword":
      if (!value) return "Confirm your password.";
      return value !== values.password ? "Passwords do not match." : undefined;
  }
}

export function validateRegistrationForm(
  values: CompanyRegistrationValues,
): CompanyRegistrationErrors {
  return (Object.keys(values) as CompanyRegistrationField[]).reduce(
    (errors, field) => {
      const message = validateRegistrationField(field, values);
      if (message) errors[field] = message;
      return errors;
    },
    {} as CompanyRegistrationErrors,
  );
}
