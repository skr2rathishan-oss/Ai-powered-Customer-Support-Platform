import type {
  CompanyRegistrationErrors,
  CompanyRegistrationPayload,
  LoginCredentials,
  LoginMode,
  LoginResult,
} from "../types/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "");

interface SignInResponse {
  success: boolean;
  message: string;
  data: {
    user: LoginResult["user"];
  };
}

interface ApiErrorResponse {
  message?: string;
  errors?: Array<{ field?: string; message?: string }>;
  error?: {
    message?: string;
  };
}

export class AuthenticationError extends Error {
  readonly status: number;
  readonly fieldErrors: CompanyRegistrationErrors;

  constructor(
    message: string,
    status: number,
    fieldErrors: CompanyRegistrationErrors = {},
  ) {
    super(message);
    this.name = "AuthenticationError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function registerCompany(
  registration: CompanyRegistrationPayload,
): Promise<LoginResult> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/company/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...registration,
        companyName: registration.companyName.trim(),
        industry: registration.industry.trim(),
        businessEmail: registration.businessEmail.trim().toLowerCase(),
        phone: registration.phone.trim(),
        website: registration.website.trim(),
        description: registration.description.trim(),
        adminFirstName: registration.adminFirstName.trim(),
        adminLastName: registration.adminLastName.trim(),
        adminEmail: registration.adminEmail.trim().toLowerCase(),
      }),
    });
  } catch {
    throw new AuthenticationError(
      "We couldn’t reach SupportPilot. Check your connection and try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | SignInResponse
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    const apiError = payload as ApiErrorResponse | null;
    const fieldErrors = (apiError?.errors ?? []).reduce<CompanyRegistrationErrors>(
      (current, error) => {
        if (error.field && error.message) {
          current[error.field as keyof CompanyRegistrationErrors] = error.message;
        }
        return current;
      },
      {},
    );

    throw new AuthenticationError(
      apiError?.message ?? "Company registration failed. Please try again.",
      response.status,
      fieldErrors,
    );
  }

  const result = payload as SignInResponse;
  return { message: result.message, user: result.data.user };
}

async function signIn(
  accountType: LoginMode,
  credentials: LoginCredentials,
): Promise<LoginResult> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/sign-in`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountType,
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      }),
    });
  } catch {
    throw new AuthenticationError(
      "We couldn’t reach SupportPilot. Check your connection and try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | SignInResponse
    | ApiErrorResponse
    | null;

  if (!response.ok) {
    const apiError = payload as ApiErrorResponse | null;
    const message =
      payload?.message ??
      apiError?.error?.message ??
      (response.status === 401
        ? "The email or password you entered is incorrect."
        : "Sign in failed. Please try again.");

    throw new AuthenticationError(message, response.status);
  }

  const result = payload as SignInResponse;
  return {
    message: result.message,
    user: result.data.user,
  };
}

// The server currently exposes one role-aware sign-in endpoint. Keep these
// wrappers separate so each mode can move to its own endpoint without changing UI code.
export function loginIndividual(
  credentials: LoginCredentials,
): Promise<LoginResult> {
  return signIn("individual", credentials);
}

export function loginCompany(
  credentials: LoginCredentials,
): Promise<LoginResult> {
  return signIn("company", credentials);
}

export async function requestPasswordReset(email: string): Promise<void> {
  // TODO(API): Replace this placeholder with POST /api/auth/forgot-password
  // when the backend exposes a password-recovery endpoint.
  void email;
  await new Promise((resolve) => window.setTimeout(resolve, 850));
}
